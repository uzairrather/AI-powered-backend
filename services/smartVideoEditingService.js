// backend/services/smartVideoEditingService.js

const path = require('path');
const fs = require('fs');
const ffmpegHelper = require('../utils/ffmpegHelper');

/**
 * Service for smart video editing features
 */
class SmartVideoEditingService {
  /**
   * Lightweight placeholder for creating an editing plan.
   * Currently returns a simple plan describing clip order and estimated durations.
   * Controller expects this method to exist.
   */
  async createEditingPlan(videoIds, prompt) {
    try {
      if (!Array.isArray(videoIds) || videoIds.length === 0) {
        return { clips: [], summary: 'No videos provided' };
      }
      return {
        clips: videoIds.map((id, index) => ({ id: String(id), order: index + 1 })),
        summary: `Auto plan generated${prompt ? ' for prompt: ' + String(prompt).slice(0, 80) : ''}`,
      };
    } catch (err) {
      console.error('createEditingPlan error:', err);
      return { clips: [], summary: 'Plan generation failed' };
    }
  }
  /**
   * Trim a video file between a start time and duration
   * @param {string} inputPath - Path to the input video
   * @param {string} outputPath - Path to save the trimmed video
   * @param {string} startTime - Start time in "HH:MM:SS" or seconds
   * @param {string|number} duration - Duration in seconds
   * @returns {Promise<string>} - Output file path
   */
  async smartTrimVideo(inputPath, outputPath, startTime, duration) {
    try {
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file does not exist: ${inputPath}`);
      }

      // Ensure output folder exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      await ffmpegHelper.trimVideo(inputPath, outputPath, startTime, duration);

      return outputPath;
    } catch (error) {
      console.error('Smart Video Editing Error (Trim):', error);
      throw error;
    }
  }

  /**
   * Example: Add other smart editing functions here
   * like scene detection, AI-based highlight extraction, etc.
   */
}

module.exports = new SmartVideoEditingService();
