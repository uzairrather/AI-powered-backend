const groq = require('../config/groq');

async function generateStoryNarrative(videoContext, prompt) {
  const systemPrompt = `You are an expert video storyteller. Given a set of video clips, their transcripts, and tags, generate a compelling, richly detailed, and imaginative story as a single flowing paragraph. Expand on the scenes, emotions, and transitions between moments. Avoid bullet points or clip-wise structure — the narrative should feel natural and immersive like a mini short story.`;

  const userPrompt = `Write the story as one continuous paragraph based on this prompt and context. Add depth, natural flow, and creative transitions.\n\nUser prompt: ${prompt}\n\nVideo context:\n${videoContext.map((v, i) => 
    `Clip ${i + 1}:\n- Filename: ${v.filename}\n- Tags: ${v.tags.join(', ')}\n- Transcript: ${v.transcription}`
  ).join('\n\n')}`;

  try {
    const response = await groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1500, // Increased from 800 for longer stories
      temperature: 0.85  // Slightly more creativity
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Groq API Error:', error);
    return `# ${prompt}\n\n[AI story generation failed. Please try again later.]`;
  }
}

module.exports = { generateStoryNarrative };
