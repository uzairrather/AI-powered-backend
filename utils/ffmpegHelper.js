const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const mime = require('mime-types');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const ffprobePath = ffprobeInstaller.path;

// ✅ Smart Trimming Function
function smartTrimVideo(inputPath, outputPath, startTime, duration) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .output(outputPath)
      .on('end', () => {
        console.log(`✅ Trimmed segment saved to ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('❌ Trimming error:', err.message);
        reject(err);
      })
      .run();
  });
}

// ✅ Smart Edited Story Assembly
async function assembleAndStoreStoryVideo(videoDocs, gfs) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'story-'));
  const trimmedFiles = [];

  try {
    for (const video of videoDocs) {
      const rawPath = path.join(tempDir, `${video._id}-raw.mp4`);
      const trimmedPath = path.join(tempDir, `${video._id}-trimmed.mp4`);

      const writeStream = fs.createWriteStream(rawPath);
      await new Promise((resolve, reject) => {
        gfs.openDownloadStream(video.gridfsId)
          .pipe(writeStream)
          .on('finish', resolve)
          .on('error', reject);
      });

      // ✅ Smart Trim: Keep only first 5 seconds
      await smartTrimVideo(rawPath, trimmedPath, 0, 5);
      trimmedFiles.push(trimmedPath);
    }

    const fileListPath = path.join(tempDir, 'inputs.txt');
    fs.writeFileSync(
      fileListPath,
      trimmedFiles.map(f => `file '${f}'`).join('\n')
    );

    const outputFile = path.join(tempDir, 'output.mp4');

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(fileListPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions([
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '23',
          '-c:a', 'aac'
        ])
        .output(outputFile)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const outStream = fs.createReadStream(outputFile);
    return await new Promise((resolve, reject) => {
      const uploadStream = gfs.openUploadStream(`story-${Date.now()}.mp4`, {
        contentType: 'video/mp4'
      });
      outStream.pipe(uploadStream)
        .on('finish', () => resolve(uploadStream.id))
        .on('error', reject);
    });
  } finally {
    [...trimmedFiles].forEach(f => fs.existsSync(f) && fs.unlinkSync(f));
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// ✅ Optional: Audio Extraction
async function extractCleanAudio(videoPath, outputPath) {
  const mimeType = mime.lookup(videoPath);

  if (mimeType && mimeType.startsWith('image/')) {
    console.log('🖼️ Skipping audio extraction — input is an image.');
    return null;
  }

  try {
    const ffprobeOutput = execSync(
      `"${ffprobePath}" -i "${videoPath}" -show_streams -select_streams a -loglevel error`
    ).toString();

    if (!ffprobeOutput.trim()) {
      console.log('🔇 No audio stream found — skipping audio extraction.');
      return null;
    }
  } catch (err) {
    console.log('⚠️ FFprobe failed or no audio stream found:', err.message);
    return null;
  }

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1'
      ])
      .format('wav')
      .save(outputPath)
      .on('end', () => {
        console.log(`✅ Audio extracted to ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('❌ Error during audio extraction:', err.message);
        reject(err);
      });
  });
}

module.exports = {
  assembleAndStoreStoryVideo,
  extractCleanAudio,
  smartTrimVideo
};
