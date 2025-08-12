const Story = require('../models/storyModel');
const Video = require('../models/videoModel');
const { getGFS } = require('../utils/gridfs');
const { generateStoryNarrative } = require('../services/groqService');
const { smartEditAndAssemble } = require('../services/videoService');
const aiTaggingService = require('../services/aiTaggingService');
const smartVideoEditingService = require('../services/smartVideoEditingService');

// 🆕 Generate story prompts based on selected videos
exports.generateStoryPrompts = async (req, res) => {
  try {
    const { videoIds, userPrompt } = req.body;

    if (!videoIds || videoIds.length === 0) {
      return res.status(400).json({ error: 'Video IDs are required' });
    }

    const videos = await Video.find({ _id: { $in: videoIds }, user: req.user._id });
    if (!videos || videos.length === 0) {
      return res.status(403).json({ error: 'You do not own these videos' });
    }

    const suggestions = await aiTaggingService.generateStoryPrompt(videos, userPrompt);
    res.json(suggestions);
  } catch (error) {
    console.error('Story prompt generation error:', error);
    res.status(500).json({ error: 'Failed to generate story prompts' });
  }
};

// 🆕 Enhanced story generation with prompt-based creation
exports.generateStory = async (req, res) => {
  try {
    const { 
      videoIds, 
      prompt, 
      title, // 🆕 Accept custom title
      clipDuration,
      storyType = 'inspirational',
      theme,
      style,
      tone,
      emotionalJourney = false,
      contrastType = 'good_vs_bad'
    } = req.body;

    if (!videoIds || videoIds.length === 0) {
      return res.status(400).json({ error: 'Video IDs are required' });
    }

    const videos = await Video.find({ _id: { $in: videoIds }, user: req.user._id });
    if (!videos || videos.length === 0) {
      return res.status(403).json({ error: 'You do not own these videos' });
    }

    // 🆕 Handle emotional journey analysis
    let emotionalJourneyData = null;
    if (emotionalJourney) {
      emotionalJourneyData = await aiTaggingService.analyzeEmotionalJourney(videos);
    }

    // Prepare context for AI
    const context = videos.map(v => ({
      filename: v.originalname,
      transcription: v.transcription,
      tags: v.tags,
      ai_tags: v.ai_tags,
      emotional_analysis: v.emotional_analysis
    }));

    // Generate narrative using Groq AI
    let narrative;
    try {
      narrative = await generateStoryNarrative(context, prompt);
    } catch (err) {
      console.error('AI generation failed:', err);
      narrative = 'Story generation failed. Please try again later.';
    }

    // 🆕 Create editing plan for smart video editing
    let editingPlan = null;
    let rendered_video_id = null;
    
    try {
      editingPlan = await smartVideoEditingService.createEditingPlan(videoIds, prompt);
      
      // Smart video editing + assembly
      if (clipDuration && !isNaN(clipDuration)) {
        rendered_video_id = await smartEditAndAssemble(videos, getGFS(), Number(clipDuration));
      } else {
        rendered_video_id = await smartEditAndAssemble(videos, getGFS());
      }
    } catch (e) {
      console.error('Video editing/assembly failed:', e.message);
    }

    // 🆕 Calculate story metadata
    const totalDuration = videos.reduce((sum, v) => sum + (v.metadata?.duration || 0), 0);
    const themes = videos.flatMap(v => v.ai_tags?.map(tag => tag.tags).flat() || []);

    // 🆕 Generate consistent title
    let storyTitle = title || 'AI Generated Story';
    if (!title && prompt) {
      // Use first sentence from prompt as title
      const firstSentence = prompt.split(/[.!?]/)[0].trim();
      if (firstSentence.length > 0 && firstSentence.length < 100) {
        storyTitle = firstSentence;
      }
    } else if (!title) {
      // Generate title based on story type and theme
      storyTitle = `${theme || 'Inspirational'} ${storyType.replace('_', ' ')}`;
    }

    // Save the enhanced story
    const story = new Story({
      title: storyTitle, // 🆕 Use the generated/consistent title
      description: 'An AI-generated story created from your videos',
      clips: videoIds,
      narrative,
      rendered_video_id,
      user: req.user._id,
      
      // 🆕 New story features
      prompt: {
        theme: theme || 'inspirational',
        style: style || 'cinematic',
        tone: tone || 'uplifting',
        user_prompt: prompt,
        target_duration: clipDuration || totalDuration
      },
      
      story_type: storyType,
      
      emotional_journey: emotionalJourney ? {
        enabled: true,
        contrast_type: contrastType,
        positive_clips: emotionalJourneyData?.positive_clips || [],
        negative_clips: emotionalJourneyData?.negative_clips || []
      } : {
        enabled: false
      },
      
      story_metadata: {
        total_duration: totalDuration,
        clip_count: videos.length,
        emotional_arc: emotionalJourneyData?.emotional_arc || {
          start_mood: 'neutral',
          end_mood: 'neutral',
          peak_moment: 'No clear emotional peak'
        },
        themes: [...new Set(themes)],
        music_suggestion: suggestMusicForMood(videos),
        color_palette: suggestColorPalette(videos)
      },
      
      ai_generation: {
        model_used: 'llama3-70b-8192',
        generation_time: Date.now(),
        confidence_score: 0.85,
        revision_count: 0
      }
    });

    await story.save();

    res.json({
      storyId: story._id,
      title: story.title,
      narrative: story.narrative,
      clips: videoIds,
      rendered_video_id,
      createdAt: story.created_at,
      storyType: story.story_type,
      emotionalJourney: story.emotional_journey,
      storyMetadata: story.story_metadata
    });

  } catch (error) {
    console.error('Story generation error:', error);
    res.status(500).json({ error: 'Failed to generate story' });
  }
};

// 🆕 Helper methods for story metadata
function suggestMusicForMood(videos) {
  const moods = videos.map(v => v.emotional_analysis?.overall_mood).filter(Boolean);
  const dominantMood = moods.length > 0 ? 
    moods.reduce((a, b) => moods.filter(v => v === a).length >= moods.filter(v => v === b).length ? a : b) : 
    'neutral';
  
  const musicSuggestions = {
    happy: 'Upbeat, energetic music',
    sad: 'Melancholic, reflective music',
    excited: 'High-energy, dynamic music',
    calm: 'Peaceful, ambient music',
    tense: 'Suspenseful, dramatic music',
    neutral: 'Balanced, moderate tempo music'
  };
  
  return musicSuggestions[dominantMood] || musicSuggestions.neutral;
}

function suggestColorPalette(videos) {
  const moods = videos.map(v => v.emotional_analysis?.overall_mood).filter(Boolean);
  const dominantMood = moods.length > 0 ? 
    moods.reduce((a, b) => moods.filter(v => v === a).length >= moods.filter(v => v === b).length ? a : b) : 
    'neutral';
  
  const colorPalettes = {
    happy: 'Warm, vibrant colors (yellows, oranges, bright blues)',
    sad: 'Cool, muted colors (blues, grays, soft purples)',
    excited: 'Bold, high-contrast colors (reds, bright greens, electric blues)',
    calm: 'Soft, pastel colors (light blues, greens, gentle pinks)',
    tense: 'Dark, dramatic colors (deep reds, blacks, dark grays)',
    neutral: 'Balanced, natural colors (earth tones, balanced contrast)'
  };
  
  return colorPalettes[dominantMood] || colorPalettes.neutral;
}

// 🆕 Create inspirational story
exports.createInspirationalStory = async (req, res) => {
  try {
    const { videoIds, theme = 'inspirational', prompt: customPrompt } = req.body;

    if (!videoIds || videoIds.length === 0) {
      return res.status(400).json({ error: 'Video IDs are required' });
    }

    const videos = await Video.find({ _id: { $in: videoIds }, user: req.user._id });
    if (!videos || videos.length === 0) {
      return res.status(403).json({ error: 'You do not own these videos' });
    }

    // 🆕 Use custom prompt if provided, otherwise use predefined inspirational prompt
    const finalPrompt = customPrompt || `Create an uplifting and inspirational story that celebrates life's beautiful moments, personal growth, and the power of human connection. Focus on the positive emotions, achievements, and meaningful relationships captured in these videos.`;

    // Generate story with inspirational theme
    const storyData = {
      videoIds,
      prompt: finalPrompt,
      storyType: 'inspirational',
      theme: theme,
      style: 'cinematic',
      tone: 'uplifting'
    };

    // Use the enhanced generateStory method
    req.body = storyData;
    return exports.generateStory(req, res);

  } catch (error) {
    console.error('Inspirational story creation error:', error);
    res.status(500).json({ error: 'Failed to create inspirational story' });
  }
};

// 🆕 Create emotional journey story
exports.createEmotionalJourney = async (req, res) => {
  try {
    const { videoIds, contrastType = 'good_vs_bad', prompt: customPrompt } = req.body;

    if (!videoIds || videoIds.length === 0) {
      return res.status(400).json({ error: 'Video IDs are required' });
    }

    const videos = await Video.find({ _id: { $in: videoIds }, user: req.user._id });
    if (!videos || videos.length === 0) {
      return res.status(403).json({ error: 'You do not own these videos' });
    }

    // 🆕 Use custom prompt if provided, otherwise use predefined emotional journey prompt
    const finalPrompt = customPrompt || `Create a compelling story that contrasts different emotional states and life choices. Show the journey from challenge to triumph, or from darkness to light, highlighting the transformative power of resilience and positive choices.`;

    // Generate story with emotional journey
    const storyData = {
      videoIds,
      prompt: finalPrompt,
      storyType: 'emotional_journey',
      theme: 'transformation',
      style: 'documentary',
      tone: 'reflective',
      emotionalJourney: true,
      contrastType: contrastType
    };

    // Use the enhanced generateStory method
    req.body = storyData;
    return exports.generateStory(req, res);

  } catch (error) {
    console.error('Emotional journey story creation error:', error);
    res.status(500).json({ error: 'Failed to create emotional journey story' });
  }
};

// Fetch stories for the logged-in user
exports.getStories = async (req, res) => {
  try {
    const stories = await Story.find({ user: req.user._id })
      .populate('clips')
      .sort({ created_at: -1 });

    res.json(stories);
  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
};

// 🆕 Get stories by type
exports.getStoriesByType = async (req, res) => {
  try {
    const { storyType } = req.params;
    
    const stories = await Story.find({ 
      user: req.user._id,
      story_type: storyType 
    })
      .populate('clips')
      .sort({ created_at: -1 });

    res.json(stories);
  } catch (error) {
    console.error('Error fetching stories by type:', error);
    res.status(500).json({ error: 'Failed to fetch stories by type' });
  }
};

// 🆕 Update story sharing settings
exports.updateStorySharing = async (req, res) => {
  try {
    const { storyId } = req.params;
    const { isPublic, shareUrl } = req.body;

    const story = await Story.findOne({ _id: storyId, user: req.user._id });
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    story.sharing.is_public = isPublic;
    if (shareUrl) story.sharing.share_url = shareUrl;
    
    await story.save();

    res.json({ 
      message: 'Story sharing updated successfully',
      sharing: story.sharing 
    });
  } catch (error) {
    console.error('Error updating story sharing:', error);
    res.status(500).json({ error: 'Failed to update story sharing' });
  }
};

// Stream rendered story video
exports.streamStoryVideo = async (req, res) => {
  try {
    const story = await Story.findOne({ _id: req.params.id, user: req.user._id });
    if (!story || !story.rendered_video_id) {
      return res.status(404).json({ error: 'Rendered video not found' });
    }

    const gfs = getGFS();
    const downloadStream = gfs.openDownloadStream(story.rendered_video_id);

    res.set({
      'Content-Type': 'video/mp4',
      'Content-Disposition': `inline; filename="story-${story._id}.mp4"`
    });

    downloadStream.pipe(res);
    downloadStream.on('error', () => res.status(404).json({ error: 'Rendered video file not found' }));

  } catch (error) {
    console.error('Video streaming error:', error);
    res.status(500).json({ error: 'Failed to stream rendered video' });
  }
};
