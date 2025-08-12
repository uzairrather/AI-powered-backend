async function simulateTranscription(buffer) {
  await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate delay

  const transcriptions = [
    "Hey everyone, welcome to our amazing trip! We're here at the beach...",
    "This is incredible! Look at this view from the mountain top...",
    "Happy birthday! We're celebrating with family and friends...",
    "Welcome to our city tour! We're exploring the historic downtown...",
    "Family dinner time! We're all gathered around the table sharing stories...",
    "Adventure time! We're kayaking down this beautiful river...",
    "Concert night! The music is incredible and the energy is electric...",
    "Cooking together in the kitchen! We're making our grandmother's famous recipe...",
    "Sunset at the park! We're having a picnic and watching the sky turn beautiful colors...",
    "Road trip! We're driving through the countryside with the windows down and music playing..."
  ];

  return transcriptions[Math.floor(Math.random() * transcriptions.length)];
}

async function simulateTagging(transcriptionText) {
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay

  const tags = [];

  if (!transcriptionText || typeof transcriptionText !== 'string') return ['misc'];

  // Very basic keyword-based tagging
  if (/hello|hi|hey/i.test(transcriptionText)) tags.push('greeting');
  if (/my name is/i.test(transcriptionText)) tags.push('introduction');
  if (/\b\d{2}\b/.test(transcriptionText)) tags.push('age');
  if (/philippines?/i.test(transcriptionText)) tags.push('philippines', 'asian');
  if (/family/i.test(transcriptionText)) tags.push('family');
  if (/friends?/i.test(transcriptionText)) tags.push('friends');
  if (/celebrat/i.test(transcriptionText)) tags.push('celebration');

  // Fallback default tags if fewer than 3
  const fallback = ['personal', 'talking', 'self'];
  while (tags.length < 4) {
    const next = fallback.shift();
    if (next && !tags.includes(next)) tags.push(next);
  }

  return tags.slice(0, 8); // Limit to max 8
}


module.exports = { simulateTranscription, simulateTagging };
