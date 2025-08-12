const Video = require('../models/videoModel');
const Story = require('../models/storyModel');
const groq = require('../config/groq');

class MemoryEngineService {
  // Build memory index for a user
  async buildMemoryIndex(userId) {
    try {
      const videos = await Video.find({ user: userId }).populate('user');
      const stories = await Story.find({ user: userId }).populate('clips');
      
      const memoryIndex = {
        user: userId,
        total_memories: videos.length,
        total_stories: stories.length,
        memory_timeline: [],
        emotional_patterns: {},
        people_network: {},
        location_history: [],
        occasion_categories: {},
        sentiment_trends: [],
        last_updated: new Date()
      };

      // Process videos for memory timeline
      for (const video of videos) {
        const memoryEntry = {
          id: video._id,
          type: 'video',
          timestamp: video.uploaded_at,
          content: video.transcription,
          mood: video.emotional_analysis?.overall_mood || 'neutral',
          location: video.memory_metadata?.location,
          occasion: video.memory_metadata?.occasion,
          people: video.memory_metadata?.people_present || [],
          tags: video.ai_tags || [],
          significance: video.memory_metadata?.significance || 'personal'
        };

        memoryIndex.memory_timeline.push(memoryEntry);

        // Track emotional patterns
        if (video.emotional_analysis?.overall_mood) {
          memoryIndex.emotional_patterns[video.emotional_analysis.overall_mood] = 
            (memoryIndex.emotional_patterns[video.emotional_analysis.overall_mood] || 0) + 1;
        }

        // Track people network
        if (video.memory_metadata?.people_present) {
          video.memory_metadata.people_present.forEach(person => {
            memoryIndex.people_network[person] = (memoryIndex.people_network[person] || 0) + 1;
          });
        }

        // Track locations
        if (video.memory_metadata?.location) {
          memoryIndex.location_history.push({
            location: video.memory_metadata.location,
            timestamp: video.uploaded_at,
            occasion: video.memory_metadata.occasion
          });
        }

        // Track occasions
        if (video.memory_metadata?.occasion) {
          memoryIndex.occasion_categories[video.memory_metadata.occasion] = 
            (memoryIndex.occasion_categories[video.memory_metadata.occasion] || 0) + 1;
        }
      }

      // Process stories
      for (const story of stories) {
        const storyEntry = {
          id: story._id,
          type: 'story',
          timestamp: story.created_at,
          title: story.title,
          content: story.narrative,
          theme: story.prompt?.theme,
          clips_count: story.clips?.length || 0,
          story_type: story.story_type
        };

        memoryIndex.memory_timeline.push(storyEntry);
      }

      // Sort timeline by timestamp
      memoryIndex.memory_timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return memoryIndex;
    } catch (error) {
      console.error('Memory Index Building Error:', error);
      throw error;
    }
  }

  // Global search across all memories
  async searchMemories(userId, query, filters = {}) {
    try {
      const searchCriteria = {
        user: userId,
        $text: { $search: query }
      };

      // Apply filters
      if (filters.dateRange) {
        searchCriteria.uploaded_at = {
          $gte: new Date(filters.dateRange.start),
          $lte: new Date(filters.dateRange.end)
        };
      }

      if (filters.mood) {
        searchCriteria['emotional_analysis.overall_mood'] = filters.mood;
      }

      if (filters.occasion) {
        searchCriteria['memory_metadata.occasion'] = filters.occasion;
      }

      if (filters.location) {
        searchCriteria['memory_metadata.location'] = { $regex: filters.location, $options: 'i' };
      }

      const videos = await Video.find(searchCriteria);
      const stories = await Story.find({ user: userId, $text: { $search: query } });

      return {
        videos,
        stories,
        total_results: videos.length + stories.length,
        search_query: query,
        filters_applied: filters
      };
    } catch (error) {
      console.error('Memory Search Error:', error);
      throw error;
    }
  }

  // Generate memory insights and patterns
  async generateMemoryInsights(userId) {
    try {
      const videos = await Video.find({ user: userId });
      
      const insights = {
        total_memories: videos.length,
        time_period: this.calculateTimePeriod(videos),
        emotional_summary: this.analyzeEmotionalPatterns(videos),
        people_summary: this.analyzePeoplePatterns(videos),
        location_summary: this.analyzeLocationPatterns(videos),
        occasion_summary: this.analyzeOccasionPatterns(videos),
        memory_density: this.calculateMemoryDensity(videos),
        suggested_themes: await this.suggestMemoryThemes(videos)
      };

      return insights;
    } catch (error) {
      console.error('Memory Insights Generation Error:', error);
      throw error;
    }
  }

  // Create memory collections (themed groups)
  async createMemoryCollection(userId, theme, videoIds) {
    try {
      const videos = await Video.find({ _id: { $in: videoIds }, user: userId });
      
      const collection = {
        user: userId,
        theme: theme,
        videos: videoIds,
        created_at: new Date(),
        metadata: {
          total_duration: videos.reduce((sum, v) => sum + (v.metadata?.duration || 0), 0),
          average_mood: this.calculateAverageMood(videos),
          people_involved: this.extractUniquePeople(videos),
          locations: [...new Set(videos.map(v => v.memory_metadata?.location).filter(Boolean))]
        }
      };

      return collection;
    } catch (error) {
      console.error('Memory Collection Creation Error:', error);
      throw error;
    }
  }

  // Generate nostalgic story suggestions
  async generateNostalgicSuggestions(userId) {
    try {
      const videos = await Video.find({ user: userId })
        .sort({ uploaded_at: -1 })
        .limit(50);

      const systemPrompt = `You are an expert in nostalgic storytelling and memory curation. Analyze video memories and suggest nostalgic story themes and prompts.`;

      const userPrompt = `Based on these video memories, suggest nostalgic story themes:

${videos.map((v, i) => `
Memory ${i + 1}:
- Content: ${v.transcription}
- Date: ${v.uploaded_at}
- Mood: ${v.emotional_analysis?.overall_mood || 'neutral'}
- Occasion: ${v.memory_metadata?.occasion || 'general'}
- People: ${v.memory_metadata?.people_present?.join(', ') || 'none'}
`).join('\n')}

Suggest 5 nostalgic story themes in JSON format:
{
  "nostalgic_themes": [
    {
      "title": "Theme title",
      "description": "Description of the nostalgic theme",
      "prompt": "Detailed prompt for story generation",
      "related_memories": ["memory_ids"],
      "emotional_tone": "nostalgic/reflective/sentimental"
    }
  ]
}`;

      const response = await groq.chat.completions.create({
        model: 'llama3-70b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.7
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Nostalgic Suggestions Error:', error);
      return {
        nostalgic_themes: [{
          title: 'My Journey',
          description: 'A nostalgic look back at personal growth',
          prompt: 'Create a nostalgic story from these memories',
          related_memories: [],
          emotional_tone: 'nostalgic'
        }]
      };
    }
  }

  // Helper methods
  calculateTimePeriod(videos) {
    if (videos.length === 0) return { start: null, end: null, span: 0 };
    
    const dates = videos.map(v => new Date(v.uploaded_at)).sort();
    const start = dates[0];
    const end = dates[dates.length - 1];
    const span = Math.ceil((end - start) / (1000 * 60 * 60 * 24)); // days
    
    return { start, end, span };
  }

  analyzeEmotionalPatterns(videos) {
    const moodCounts = {};
    videos.forEach(video => {
      const mood = video.emotional_analysis?.overall_mood || 'neutral';
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    });
    
    const dominantMood = Object.entries(moodCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'neutral';
    
    return { moodCounts, dominantMood };
  }

  analyzePeoplePatterns(videos) {
    const peopleCounts = {};
    videos.forEach(video => {
      const people = video.memory_metadata?.people_present || [];
      people.forEach(person => {
        peopleCounts[person] = (peopleCounts[person] || 0) + 1;
      });
    });
    
    return peopleCounts;
  }

  analyzeLocationPatterns(videos) {
    const locationCounts = {};
    videos.forEach(video => {
      const location = video.memory_metadata?.location;
      if (location) {
        locationCounts[location] = (locationCounts[location] || 0) + 1;
      }
    });
    
    return locationCounts;
  }

  analyzeOccasionPatterns(videos) {
    const occasionCounts = {};
    videos.forEach(video => {
      const occasion = video.memory_metadata?.occasion;
      if (occasion) {
        occasionCounts[occasion] = (occasionCounts[occasion] || 0) + 1;
      }
    });
    
    return occasionCounts;
  }

  calculateMemoryDensity(videos) {
    if (videos.length === 0) return 0;
    
    const dates = videos.map(v => new Date(v.uploaded_at).toDateString());
    const uniqueDates = new Set(dates);
    
    return {
      total_memories: videos.length,
      unique_days: uniqueDates.size,
      average_per_day: videos.length / uniqueDates.size
    };
  }

  async suggestMemoryThemes(videos) {
    try {
      const systemPrompt = `You are an expert in identifying themes and patterns in personal memories.`;
      
      const userPrompt = `Analyze these memories and suggest 5 main themes:

${videos.slice(0, 20).map((v, i) => `
Memory ${i + 1}: ${v.transcription}
`).join('\n')}

Return themes as JSON array: ["theme1", "theme2", "theme3", "theme4", "theme5"]`;

      const response = await groq.chat.completions.create({
        model: 'llama3-70b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 500,
        temperature: 0.5
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      return ['Personal Growth', 'Family Moments', 'Achievements', 'Daily Life', 'Special Occasions'];
    }
  }

  calculateAverageMood(videos) {
    const moods = videos.map(v => v.emotional_analysis?.overall_mood).filter(Boolean);
    if (moods.length === 0) return 'neutral';
    
    const moodCounts = {};
    moods.forEach(mood => {
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    });
    
    return Object.entries(moodCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'neutral';
  }

  extractUniquePeople(videos) {
    const people = new Set();
    videos.forEach(video => {
      const videoPeople = video.memory_metadata?.people_present || [];
      videoPeople.forEach(person => people.add(person));
    });
    return Array.from(people);
  }
}

module.exports = new MemoryEngineService();


