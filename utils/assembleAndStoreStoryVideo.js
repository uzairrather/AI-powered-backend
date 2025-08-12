const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { smartTrimVideo } = require('./ffmpegHelper'); // ✅ Import helper

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

async function assembleAndStoreStoryVideo(videoDocs, gfs) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'story-'));
  const rawFiles = [];
  const trimmedFiles = [];

  try {
    for (const video of videoDocs) {
      // ✅ Step 1: Download original video from GridFS
      const rawFile = path.join(tempDir, `${video._id}-raw.mp4`);
      const writeStream = fs.createWriteStream(rawFile);
      await new Promise((resolve, reject) => {
        gfs.openDownloadStream(video.gridfsId)
          .pipe(writeStream)
          .on('finish', resolve)
          .on('error', reject);
      });
      rawFiles.push(rawFile);

      // ✅ Step 2: Trim 5s clip
      const trimmedFile = path.join(tempDir, `${video._id}-trimmed.mp4`);
      await smartTrimVideo(rawFile, trimmedFile, 0, 5); // ⏱ Trim 0–5 seconds
      trimmedFiles.push(trimmedFile);
    }

    // ✅ Step 3: Prepare concat list file
    const fileListPath = path.join(tempDir, 'inputs.txt');
    fs.writeFileSync(
      fileListPath,
      trimmedFiles.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n')
    );

    const outputFile = path.join(tempDir, 'output.mp4');

    // ✅ Step 4: Concatenate trimmed videos
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(fileListPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions([
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '128k'
        ])
        .output(outputFile)
        .on('end', () => {
          console.log(`✅ Final story video created at ${outputFile}`);
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg error:', err.message);
          reject(err);
        })
        .run();
    });

    // ✅ Step 5: Upload merged video to GridFS
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
    // ✅ Clean up all temp files
    [...rawFiles, ...trimmedFiles].forEach(f => fs.existsSync(f) && fs.unlinkSync(f));
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = { assembleAndStoreStoryVideo };
