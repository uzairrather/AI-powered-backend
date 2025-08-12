// backend/utils/imageOcrHelper.js
const Tesseract = require('tesseract.js');

async function extractTextFromImage(imagePath) {
  try {
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng');
    console.log("🧠 OCR Text Extracted:", text);
    return text.trim();
  } catch (err) {
    console.error('❌ OCR failed:', err.message);
    return '';
  }
}

module.exports = { extractTextFromImage };
