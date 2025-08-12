const groq = require('../config/groq'); // or openai

async function extractKeywordsFromQuery(naturalQuery) {
  try {
    const response = await groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [
        {
          role: 'system',
          content: 'Extract 3 to 5 relevant keywords or tags from this natural language query. Only return comma-separated keywords.'
        },
        {
          role: 'user',
          content: naturalQuery
        }
      ],
      temperature: 0.4
    });

    const keywordText = response.choices[0].message.content;
    return keywordText.split(',').map(k => k.trim());
  } catch (err) {
    console.error('Keyword extraction failed:', err);
    return [];
  }
}

module.exports = { extractKeywordsFromQuery };
