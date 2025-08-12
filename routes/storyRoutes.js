const express = require('express');
const router = express.Router();
const storyController = require('../controllers/storyController');
const { ensureAuthenticated } = require('../middleware/authMiddleware');

// 🆕 Story prompt generation
router.post('/prompts', ensureAuthenticated, storyController.generateStoryPrompts);

// 🆕 Enhanced story generation
router.post('/generate', ensureAuthenticated, storyController.generateStory);

// 🆕 Specialized story types
router.post('/inspirational', ensureAuthenticated, storyController.createInspirationalStory);
router.post('/emotional-journey', ensureAuthenticated, storyController.createEmotionalJourney);

// 🆕 Story management
router.get('/', ensureAuthenticated, storyController.getStories);
router.get('/type/:storyType', ensureAuthenticated, storyController.getStoriesByType);
router.put('/:storyId/sharing', ensureAuthenticated, storyController.updateStorySharing);

// 🆕 Video streaming
router.get('/:id/video', ensureAuthenticated, storyController.streamStoryVideo);

module.exports = router;
