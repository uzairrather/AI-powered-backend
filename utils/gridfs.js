const { GridFSBucket } = require('mongodb');

let gfs;

function initGridFS(connection) {
  gfs = new GridFSBucket(connection.db, { bucketName: 'videos' });
  console.log('✅ GridFS initialized');
}

function getGFS() {
  if (!gfs) throw new Error('GridFS is not initialized yet');
  return gfs;
}

module.exports = { initGridFS, getGFS };
