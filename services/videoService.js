const fs = require('fs');
const path = require('path');
const os = require('os');
const Video = require('../models/videoModel');
const { transcribeWithAssemblyAI } = require('./assemblyService');
const { extractCleanAudio, assembleAndStoreStoryVideo, smartTrimVideo } = require('../utils/ffmpegHelper');
const { simulateTagging } = require('../utils/simulationUtils');

// ✅ Process uploaded video: audio, transcript, tags
async function processVideoWithGroq(videoId, buffer) {
  const tempDir = path.join(__dirname, '../../temp');
  const videoPath = path.join(tempDir, `${videoId}.mp4`);
  const audioPath = path.join(tempDir, `${videoId}.wav`);

  try {
    await fs.promises.mkdir(tempDir, { recursive: true });

    console.log(`ℹ️ Buffer size: ${buffer?.length || 0} bytes`);
    if (!buffer || buffer.length < 1000) {
      throw new Error('❌ Video buffer too small or empty. Invalid upload.');
    }

    await fs.promises.writeFile(videoPath, buffer);
    console.log(`✅ Video file saved at ${videoPath}`);

    await extractCleanAudio(videoPath, audioPath);
    console.log(`✅ Audio extracted to ${audioPath}`);

    const transcription = await transcribeWithAssemblyAI(audioPath);
    console.log(`✅ Transcription: ${transcription}`);

    let tags = await simulateTagging(transcription);
    if (!tags || tags.length === 0) {
      tags = ['misc'];
      console.log('⚠️ No tags extracted. Using fallback tag: misc');
    }

    await Video.findByIdAndUpdate(videoId, {
      transcription,
      tags,
      processing_status: 'completed',
    });

    console.log(`✅ Video ${videoId} processed successfully`);
  } catch (error) {
    console.error('❌ Error processing video:', error.message);
    await Video.findByIdAndUpdate(videoId, { processing_status: 'error' });
  } finally {
    for (const file of [videoPath, audioPath]) {
      try {
        if (fs.existsSync(file)) await fs.promises.unlink(file);
      } catch (err) {
        console.warn(`⚠️ Failed to delete temp file ${file}: ${err.message}`);
      }
    }
  }
}

// ✅ Assemble videos, respecting an optional target duration
async function smartEditAndAssemble(videoDocs, gfs, targetDurationSeconds) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smartedit-'));
  const workingFiles = [];

  try {
    const ffmpeg = require('fluent-ffmpeg');

    // If a target duration is provided, trim each clip to fit evenly
    if (targetDurationSeconds && Number.isFinite(targetDurationSeconds)) {
      const perClipSeconds = Math.max(2, Math.floor(targetDurationSeconds / Math.max(1, videoDocs.length)));
      const trimmedPaths = [];

      for (const video of videoDocs) {
        const rawPath = path.join(tempDir, `${video._id}-raw.mp4`);
        const trimmedPath = path.join(tempDir, `${video._id}-trimmed.mp4`);

        const downloadStream = gfs.openDownloadStream(video.gridfsId);
        const writeStream = fs.createWriteStream(rawPath);
        await new Promise((resolve, reject) =>
          downloadStream.pipe(writeStream).on('finish', resolve).on('error', reject)
        );
        workingFiles.push(rawPath);

        // Trim from start for per-clip duration
        await smartTrimVideo(rawPath, trimmedPath, 0, perClipSeconds);
        workingFiles.push(trimmedPath);
        trimmedPaths.push(trimmedPath);
      }

      // Concat trimmed parts
      const fileListPath = path.join(tempDir, 'inputs.txt');
      fs.writeFileSync(fileListPath, trimmedPaths.map(f => `file '${f}'`).join('\n'));

      const finalOutput = path.join(tempDir, 'story.mp4');
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(fileListPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .outputOptions([
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '23',
            '-c:a', 'aac',
            // Ensure final duration does not exceed target by applying output limit
            '-t', String(targetDurationSeconds)
          ])
          .output(finalOutput)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });

      const outStream = fs.createReadStream(finalOutput);
      return await new Promise((resolve, reject) => {
        const uploadStream = gfs.openUploadStream(`story-${Date.now()}.mp4`, { contentType: 'video/mp4' });
        outStream.pipe(uploadStream)
          .on('finish', () => resolve(uploadStream.id))
          .on('error', reject);
      });
    }

    // Fallback: concatenate full clips without trimming
    const allVideos = [];
    for (const video of videoDocs) {
      const tempPath = path.join(tempDir, `${video._id}.mp4`);
      const downloadStream = gfs.openDownloadStream(video.gridfsId);
      const writeStream = fs.createWriteStream(tempPath);

      await new Promise((resolve, reject) =>
        downloadStream.pipe(writeStream).on('finish', resolve).on('error', reject)
      );

      workingFiles.push(tempPath);
      allVideos.push(tempPath);
    }

    const fileListPath = path.join(tempDir, 'inputs.txt');
    fs.writeFileSync(fileListPath, allVideos.map(f => `file '${f}'`).join('\n'));

    const finalOutput = path.join(tempDir, 'story.mp4');
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(fileListPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy'])
        .output(finalOutput)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const outStream = fs.createReadStream(finalOutput);
    return await new Promise((resolve, reject) => {
      const uploadStream = gfs.openUploadStream(`story-${Date.now()}.mp4`, { contentType: 'video/mp4' });
      outStream.pipe(uploadStream)
        .on('finish', () => resolve(uploadStream.id))
        .on('error', reject);
    });
  } finally {
    // Clean up temp files
    for (const f of workingFiles) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
    }
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = {
  processVideoWithGroq,
  assembleAndStoreStoryVideo,
  smartEditAndAssemble,
};
