const { AssemblyAI } = require('assemblyai');
const path = require('path');

const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });

async function transcribeWithAssemblyAI(audioPath) {
  try {
    const transcript = await client.transcripts.transcribe({
      audio: audioPath, // can be file path or public URL
      punctuate: true,
      format_text: true,
      disfluencies: false,
      speaker_labels: false,
      language_code: 'en_us', // optional but recommended
      speech_model: 'best', // or 'nova' (cheap & fast)
    });

    return transcript.text;
  } catch (error) {
    console.error('Transcription error:', error.message);
    throw error;
  }
}

module.exports = { transcribeWithAssemblyAI };
