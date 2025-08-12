const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');

// Upload and metadata routes
router.post('/upload', videoController.uploadMiddleware, videoController.uploadVideo);
router.get('/', videoController.getVideos);
router.get('/search', videoController.searchVideos); // ✅ ADDED: Search API
router.get('/:id/status', videoController.getVideoStatus);

// 🆕 Memory engine routes
router.get('/memories/search', videoController.searchMemories);
router.get('/memories/insights', videoController.getMemoryInsights);
router.get('/memories/nostalgic-suggestions', videoController.getNostalgicSuggestions);

// 🔍 Debug: stream request
router.get('/:id/stream', (req, res, next) => {
  // console.log("📥 [Router] Received stream request for ID:", req.params.id);
  next();
}, videoController.streamVideo);

// ✅ Keep this LAST or it will override others
router.get('/:id', (req, res, next) => {
  // console.log("📦 [Router] Serving direct video for GridFS ID:", req.params.id);
  next();
}, videoController.serveVideoById);

module.exports = router;
