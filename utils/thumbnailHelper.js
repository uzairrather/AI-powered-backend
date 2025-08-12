const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { getGFS } = require('./gridfs');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Extracts a thumbnail from the first frame of a video buffer and stores it in GridFS.
 * @param {Buffer} videoBuffer - Buffer of the uploaded video.
 * @param {string} filename - Name to associate with the thumbnail image.
 * @returns {Promise<ObjectId>} - Returns GridFS ObjectId of the stored thumbnail.
 */
async function generateThumbnailFromBuffer(videoBuffer, filename) {
  const tempDir = os.tmpdir();
  const tempVideoPath = path.join(tempDir, `${filename}-temp.mp4`);
  const tempThumbPath = path.join(tempDir, `${filename}-thumb.png`);

  // Write video buffer to temp file
  fs.writeFileSync(tempVideoPath, videoBuffer);

  return new Promise((resolve, reject) => {
    ffmpeg(tempVideoPath)
      .on('end', async () => {
        try {
          const gfs = getGFS();
          const readStream = fs.createReadStream(tempThumbPath);
          const uploadStream = gfs.openUploadStream(`${filename}-thumbnail.png`, {
            contentType: 'image/png',
            metadata: { generatedFrom: filename },
          });

          readStream.pipe(uploadStream)
            .on('error', (err) => reject(err))
            .on('finish', () => {
              // Cleanup temp files
              fs.unlink(tempVideoPath, () => {});
              fs.unlink(tempThumbPath, () => {});
              resolve(uploadStream.id); // Return ObjectId of thumbnail
            });
        } catch (err) {
          reject(err);
        }
      })
      .on('error', (err) => reject(err))
      .screenshots({
        count: 1,
        folder: tempDir,
        filename: `${filename}-thumb.png`,
        size: '320x240',
      });
  });
}

module.exports = { generateThumbnailFromBuffer };
