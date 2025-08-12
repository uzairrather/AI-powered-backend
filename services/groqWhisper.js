const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

async function transcribeWithGroqWhisper(audioBuffer, filename = 'audio.wav') {
  try {
    const form = new FormData();
    form.append('file', audioBuffer, {
      filename,
      contentType: 'audio/wav',
    });
    form.append('model', 'whisper-1'); // required for OpenAI-style API

    const response = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        },
      }
    );

    return response.data.text;
  } catch (error) {
    console.error('❌ Groq transcription failed:', error.response?.data || error.message);
    throw new Error('Groq transcription failed');
  }
}

module.exports = { transcribeWithGroqWhisper };
