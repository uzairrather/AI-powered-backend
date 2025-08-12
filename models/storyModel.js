const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema;

const storySchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  clips: [{ type: ObjectId, ref: 'Video' }],
  narrative: { type: String, required: true },
  rendered_video_id: { type: ObjectId },
  user: { type: ObjectId, ref: 'User', required: true }, // ✅ Add user reference
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },

  // 🆕 New story creation features
  prompt: {
    theme: String, // 'inspirational', 'nostalgic', 'adventure', 'family', 'achievement', etc.
    style: String, // 'cinematic', 'documentary', 'vlog', 'storybook', etc.
    tone: String, // 'uplifting', 'reflective', 'energetic', 'calm', etc.
    user_prompt: String, // The actual prompt from user
    target_duration: Number // in seconds
  },

  story_type: {
    type: String,
    enum: ['inspirational', 'emotional_journey', 'memory_lane', 'achievement', 'family_moment', 'custom'],
    default: 'inspirational'
  },

  emotional_journey: {
    enabled: { type: Boolean, default: false },
    contrast_type: {
      type: String,
      enum: ['good_vs_bad', 'before_vs_after', 'struggle_vs_triumph', 'sadness_vs_joy'],
      default: 'good_vs_bad'
    },
    positive_clips: [{ type: ObjectId, ref: 'Video' }],
    negative_clips: [{ type: ObjectId, ref: 'Video' }]
  },

  story_metadata: {
    total_duration: Number,
    clip_count: Number,
    emotional_arc: {
      start_mood: String,
      end_mood: String,
      peak_moment: String
    },
    themes: [String],
    music_suggestion: String,
    color_palette: String
  },

  sharing: {
    is_public: { type: Boolean, default: false },
    share_url: String,
    view_count: { type: Number, default: 0 },
    likes: [{ type: ObjectId, ref: 'User' }],
    comments: [{
      user: { type: ObjectId, ref: 'User' },
      text: String,
      created_at: { type: Date, default: Date.now }
    }]
  },

  ai_generation: {
    model_used: String,
    generation_time: Number,
    confidence_score: Number,
    revision_count: { type: Number, default: 0 }
  }
});

// 🆕 Add text index for story search
storySchema.index({
  title: 'text',
  description: 'text',
  narrative: 'text',
  'prompt.theme': 'text',
  'story_metadata.themes': 'text'
});

module.exports = mongoose.model('Story', storySchema);
