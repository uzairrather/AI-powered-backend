const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');

const videoSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalname: { type: String, required: true },
  contentType: { type: String, required: true },
  size: { type: Number, required: true },
  gridfsId: { type: ObjectId, required: true },
  transcription: { type: String, default: '' },
  tags: [{ type: String }],
  timestamps: [
    {
      start: String,
      end: String,
      context: String
    }
  ],
  faces_detected: [{ type: String }],
  metadata: {
    duration: Number,
    resolution: String,
    format: String
  },
  processing_status: {
    type: String,
    enum: ['uploading', 'processing', 'completed', 'error'],
    default: 'uploading'
  },
  uploaded_at: { type: Date, default: Date.now },

  // ✅ Add user reference
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // 🆕 New AI-enhanced features
  ai_tags: [{
    category: String, // 'objects', 'scenes', 'activities', 'emotions', 'people'
    tags: [String],
    confidence: Number
  }],
  
  emotional_analysis: {
    overall_mood: String, // 'happy', 'sad', 'excited', 'calm', 'tense', etc.
    emotional_peaks: [{
      timestamp: String,
      emotion: String,
      intensity: Number
    }],
    sentiment_score: Number // -1 to 1
  },

  memory_metadata: {
    location: String,
    date_recorded: Date,
    people_present: [String],
    occasion: String,
    significance: String, // 'personal', 'family', 'celebration', 'milestone', etc.
    privacy_level: {
      type: String,
      enum: ['public', 'private', 'family', 'friends'],
      default: 'private'
    }
  },

  search_metadata: {
    keywords: [String],
    description: String,
    highlights: [String]
  }
});

// 🆕 Add text index for better search functionality
videoSchema.index({
  transcription: 'text',
  'ai_tags.tags': 'text',
  'search_metadata.keywords': 'text',
  'search_metadata.description': 'text',
  'memory_metadata.occasion': 'text',
  'memory_metadata.people_present': 'text'
});

module.exports = mongoose.model('Video', videoSchema);
