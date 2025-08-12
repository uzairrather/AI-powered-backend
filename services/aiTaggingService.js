const groq = require('../config/groq');

function parseLLMJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty LLM response');
  }

  // Prefer fenced ```json blocks if present
  const fenced =
    text.match(/```json\s*([\s\S]*?)```/i) ||
    text.match(/```\s*([\s\S]*?)```/);

  let candidate = (fenced ? fenced[1] : text).trim();

  // Remove preamble before first { or [
  const firstBrace = candidate.indexOf('{');
  const firstBracket = candidate.indexOf('[');
  const starts = [firstBrace, firstBracket].filter((i) => i >= 0);
  if (starts.length) candidate = candidate.slice(Math.min(...starts)).trim();

  // Cut everything after the last } or ]
  const lastBrace = candidate.lastIndexOf('}');
  const lastBracket = candidate.lastIndexOf(']');
  const end = Math.max(lastBrace, lastBracket);
  if (end >= 0) candidate = candidate.slice(0, end + 1).trim();

  return JSON.parse(candidate);
}

class AITaggingService {
  // Analyze video content and generate comprehensive tags
  async analyzeVideoContent(transcription, metadata = {}) {
    try {
      const systemPrompt = `You are an expert video content analyzer. Analyze the provided video information and generate comprehensive tags across multiple categories. Be specific and detailed in your analysis.`;

      const userPrompt = `Analyze this video content and provide detailed tags in the following JSON format:

{
  "ai_tags": [
    {
      "category": "objects",
      "tags": ["list of objects detected"],
      "confidence": 0.9
    },
    {
      "category": "scenes", 
      "tags": ["list of scene descriptions"],
      "confidence": 0.9
    },
    {
      "category": "activities",
      "tags": ["list of activities happening"],
      "confidence": 0.9
    },
    {
      "category": "emotions",
      "tags": ["list of emotions detected"],
      "confidence": 0.9
    },
    {
      "category": "people",
      "tags": ["list of people descriptions"],
      "confidence": 0.9
    }
  ],
  "emotional_analysis": {
    "overall_mood": "primary emotion",
    "emotional_peaks": [
      {
        "timestamp": "00:00",
        "emotion": "emotion name",
        "intensity": 0.8
      }
    ],
    "sentiment_score": 0.5
  },
  "memory_metadata": {
    "location": "inferred location",
    "occasion": "type of occasion",
    "significance": "personal/family/celebration/milestone",
    "people_present": ["list of people mentioned"]
  },
  "search_metadata": {
    "keywords": ["searchable keywords"],
    "description": "brief video description",
    "highlights": ["key moments"]
  }
}

Video Information:
- Transcription: ${transcription}
- Duration: ${metadata.duration || 'unknown'}
- Resolution: ${metadata.resolution || 'unknown'}
- Format: ${metadata.format || 'unknown'}

Return ONLY valid JSON with no extra text or explanations.`;

      const response = await groq.chat.completions.create({
        model: 'llama3-70b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.3
      });

      const modelText = response?.choices?.[0]?.message?.content || '';
      const result = parseLLMJson(modelText);
      return result;
    } catch (error) {
      console.error('AI Tagging Error:', error?.message || error, '(truncated reply logged if non-JSON)');
      return this.getDefaultTags();
    }
  }

  // Generate tags for emotional journey analysis
  async analyzeEmotionalJourney(videos) {
    try {
      const systemPrompt = `You are an expert in emotional storytelling and video analysis. Analyze a collection of videos to identify emotional patterns and categorize them for storytelling purposes.`;

      const userPrompt = `Analyze these videos and categorize them for emotional journey storytelling:

${videos.map((v, i) => `
Video ${i + 1}:
- Transcription: ${v.transcription}
- Tags: ${v.tags?.join(', ') || 'none'}
- AI Tags: ${JSON.stringify(v.ai_tags || [])}
`).join('\n')}

Categorize each video as either POSITIVE or NEGATIVE based on emotional content, and provide a brief explanation for each categorization.

Return ONLY this JSON (no prose before/after):
{
  "positive_clips": ["video_ids"],
  "negative_clips": ["video_ids"],
  "emotional_arc": {
    "start_mood": "overall starting mood",
    "end_mood": "overall ending mood",
    "peak_moment": "description of emotional peak"
  },
  "contrast_type": "good_vs_bad|before_vs_after|struggle_vs_triumph|sadness_vs_joy"
}`;

      const response = await groq.chat.completions.create({
        model: 'llama3-70b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.4
      });

      const modelText = response?.choices?.[0]?.message?.content || '';
      return parseLLMJson(modelText);
    } catch (error) {
      console.error('Emotional Journey Analysis Error:', error?.message || error);
      return {
        positive_clips: [],
        negative_clips: [],
        emotional_arc: {
          start_mood: 'neutral',
          end_mood: 'neutral',
          peak_moment: 'No clear emotional peak detected'
        },
        contrast_type: 'good_vs_bad'
      };
    }
  }

  // Generate inspirational story prompts
  async generateStoryPrompt(videos, userPrompt = '') {
    try {
      const systemPrompt = `You are an expert storyteller and video editor. Create compelling story prompts based on video content that will inspire meaningful storytelling.`;

      const videoContext = videos.map((v, i) => `
Video ${i + 1}:
- Content: ${v.transcription}
- Tags: ${v.tags?.join(', ') || 'none'}
- Mood: ${v.emotional_analysis?.overall_mood || 'neutral'}
`).join('\n');

      const userPromptText = userPrompt ? `User's specific request: ${userPrompt}\n\n` : '';

      const prompt = `${userPromptText}Based on these videos, suggest story creation options:

${videoContext}

Return ONLY this JSON (no preface/suffix):
{
  "suggested_themes": ["theme1", "theme2", "theme3"],
  "suggested_styles": ["style1", "style2", "style3"],
  "suggested_tones": ["tone1", "tone2", "tone3"],
  "story_prompts": [
    {
      "title": "Story title",
      "description": "Brief description",
      "prompt": "Detailed prompt for AI story generation"
    }
  ],
  "emotional_journey_options": [
    {
      "type": "contrast_type",
      "description": "Description of the journey"
    }
  ]
}`;

      const response = await groq.chat.completions.create({
        model: 'llama3-70b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.7
      });

      const modelText = response?.choices?.[0]?.message?.content || '';
      return parseLLMJson(modelText);
    } catch (error) {
      console.error('Story Prompt Generation Error:', error?.message || error);
      return {
        suggested_themes: ['inspirational', 'nostalgic', 'achievement'],
        suggested_styles: ['cinematic', 'documentary', 'vlog'],
        suggested_tones: ['uplifting', 'reflective', 'energetic'],
        story_prompts: [{
          title: 'My Story',
          description: 'A personal journey through memories',
          prompt: 'Create an inspirational story from these video clips'
        }],
        emotional_journey_options: [{
          type: 'good_vs_bad',
          description: 'Contrast between positive and challenging moments'
        }]
      };
    }
  }

  getDefaultTags() {
    return {
      ai_tags: [
        {
          category: 'objects',
          tags: ['video content'],
          confidence: 0.5
        },
        {
          category: 'scenes',
          tags: ['general scene'],
          confidence: 0.5
        },
        {
          category: 'activities',
          tags: ['recording'],
          confidence: 0.5
        },
        {
          category: 'emotions',
          tags: ['neutral'],
          confidence: 0.5
        },
        {
          category: 'people',
          tags: ['speaker'],
          confidence: 0.5
        }
      ],
      emotional_analysis: {
        overall_mood: 'neutral',
        emotional_peaks: [],
        sentiment_score: 0
      },
      memory_metadata: {
        location: 'unknown',
        occasion: 'general',
        significance: 'personal',
        people_present: []
      },
      search_metadata: {
        keywords: ['video', 'recording'],
        description: 'Video recording',
        highlights: ['content recorded']
      }
    };
  }
}

module.exports = new AITaggingService();
