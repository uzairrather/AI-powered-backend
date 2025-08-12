const multer = require("multer");
const Video = require("../models/videoModel");
const { getGFS } = require("../utils/gridfs");
const mongoose = require("mongoose");
const { processVideoWithGroq } = require("../services/videoService");
const { getGridFSBucket } = require("../utils/gridfs");
const aiTaggingService = require("../services/aiTaggingService");
const memoryEngineService = require("../services/memoryEngineService");

// Multer config
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

// Upload video
exports.uploadMiddleware = upload.single("video");

exports.uploadVideo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    if (!req.user)
      return res.status(401).json({ error: "User not authenticated" });

    const { originalname, mimetype, size, buffer } = req.file;
    const gfs = getGFS();

    const uploadStream = gfs.openUploadStream(originalname, {
      contentType: mimetype,
      metadata: { originalname, uploadDate: new Date() },
    });

    const video = new Video({
      filename: uploadStream.filename,
      originalname,
      contentType: mimetype,
      size,
      gridfsId: uploadStream.id,
      processing_status: "processing",
      user: req.user._id, // ✅ Associate with logged-in user
    });

    await video.save();
    uploadStream.end(buffer);

    uploadStream.on("finish", async () => {
      try {
        const chunks = [];
        const gfsStream = gfs.openDownloadStream(uploadStream.id);

        gfsStream.on("data", (chunk) => chunks.push(chunk));
        gfsStream.on("end", async () => {
          const fullBuffer = Buffer.concat(chunks);
          await processVideoWithGroq(video._id, fullBuffer);
          
          // 🆕 Add AI tagging after transcription is complete
          await enhanceVideoWithAI(video._id);
        });
        gfsStream.on("error", (err) => {
          console.error("❌ Error reading from GridFS for processing:", err);
        });
      } catch (err) {
        console.error("❌ Error during post-upload processing:", err);
      }
    });

    res.json({
      message: "Video uploaded successfully",
      videoId: video._id,
      filename: originalname,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
};

// 🆕 Enhanced video processing with AI tagging
async function enhanceVideoWithAI(videoId) {
  try {
    const video = await Video.findById(videoId);
    if (!video || !video.transcription) return;

    // Get video metadata
    const metadata = {
      duration: video.metadata?.duration,
      resolution: video.metadata?.resolution,
      format: video.metadata?.format
    };

    // Analyze video content with AI
    const aiAnalysis = await aiTaggingService.analyzeVideoContent(
      video.transcription, 
      metadata
    );

    // Update video with AI analysis
    await Video.findByIdAndUpdate(videoId, {
      ai_tags: aiAnalysis.ai_tags,
      emotional_analysis: aiAnalysis.emotional_analysis,
      memory_metadata: aiAnalysis.memory_metadata,
      search_metadata: aiAnalysis.search_metadata,
      processing_status: "completed"
    });

    console.log(`✅ AI enhancement completed for video ${videoId}`);
  } catch (error) {
    console.error(`❌ AI enhancement failed for video ${videoId}:`, error);
    // Don't fail the upload, just log the error
  }
}

// Fetch all videos for logged-in user
exports.getVideos = async (req, res) => {
  try {
    if (!req.user)
      return res.status(401).json({ error: "User not authenticated" });

    const videos = await Video.find({ user: req.user._id }).sort({
      uploaded_at: -1,
    });
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch videos" });
  }
};

// 🆕 Enhanced search with AI tags and memory features
exports.searchVideos = async (req, res) => {
  try {
    if (!req.user)
      return res.status(401).json({ error: "User not authenticated" });

    const { q, filters } = req.query;
    if (!q) return res.status(400).json({ error: "Search query required" });

    // Parse filters
    const searchFilters = filters ? JSON.parse(filters) : {};
    
    // Build search criteria
    const searchCriteria = {
      user: req.user._id,
      $or: [
        { transcription: { $regex: q, $options: "i" } },
        { tags: { $in: [new RegExp(q, "i")] } },
        { originalname: { $regex: q, $options: "i" } },
        { "ai_tags.tags": { $in: [new RegExp(q, "i")] } },
        { "search_metadata.keywords": { $in: [new RegExp(q, "i")] } },
        { "search_metadata.description": { $regex: q, $options: "i" } },
        { "memory_metadata.occasion": { $regex: q, $options: "i" } },
        { "memory_metadata.people_present": { $in: [new RegExp(q, "i")] } }
      ]
    };

    // Apply additional filters
    if (searchFilters.mood) {
      searchCriteria["emotional_analysis.overall_mood"] = searchFilters.mood;
    }

    if (searchFilters.occasion) {
      searchCriteria["memory_metadata.occasion"] = searchFilters.occasion;
    }

    if (searchFilters.dateRange) {
      searchCriteria.uploaded_at = {
        $gte: new Date(searchFilters.dateRange.start),
        $lte: new Date(searchFilters.dateRange.end)
      };
    }

    const videos = await Video.find(searchCriteria).sort({ uploaded_at: -1 });

    // 🆕 Return just the videos array for frontend compatibility
    res.json(videos);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
};

// 🆕 Memory engine search
exports.searchMemories = async (req, res) => {
  try {
    if (!req.user)
      return res.status(401).json({ error: "User not authenticated" });

    const { query, filters } = req.query;
    if (!query) return res.status(400).json({ error: "Search query required" });

    const parsedFilters = filters ? JSON.parse(filters) : {};
    const results = await memoryEngineService.searchMemories(
      req.user._id, 
      query, 
      parsedFilters
    );

    res.json(results);
  } catch (error) {
    console.error("Memory search error:", error);
    res.status(500).json({ error: "Memory search failed" });
  }
};

// 🆕 Get memory insights
exports.getMemoryInsights = async (req, res) => {
  try {
    if (!req.user)
      return res.status(401).json({ error: "User not authenticated" });

    const insights = await memoryEngineService.generateMemoryInsights(req.user._id);
    res.json(insights);
  } catch (error) {
    console.error("Memory insights error:", error);
    res.status(500).json({ error: "Failed to generate memory insights" });
  }
};

// 🆕 Get nostalgic story suggestions
exports.getNostalgicSuggestions = async (req, res) => {
  try {
    if (!req.user)
      return res.status(401).json({ error: "User not authenticated" });

    const suggestions = await memoryEngineService.generateNostalgicSuggestions(req.user._id);
    res.json(suggestions);
  } catch (error) {
    console.error("Nostalgic suggestions error:", error);
    res.status(500).json({ error: "Failed to generate nostalgic suggestions" });
  }
};

// Stream video using dedicated /:id/stream route
exports.streamVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ error: "Video not found" });

    const gfs = getGFS();
    const downloadStream = gfs.openDownloadStream(video.gridfsId);

    res.set({
      "Content-Type": video.contentType,
      "Content-Disposition": `inline; filename="${video.originalname}"`,
    });

    downloadStream.pipe(res);
    downloadStream.on("error", () =>
      res.status(404).json({ error: "Video file not found" })
    );
  } catch (error) {
    res.status(500).json({ error: "Failed to stream video" });
  }
};

// Get processing status
exports.getVideoStatus = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ error: "Video not found" });

    res.json({ status: video.processing_status });
  } catch (error) {
    res.status(500).json({ error: "Failed to get status" });
  }
};

// ✅ NEW: Serve video directly by ID for <video src="/api/videos/:id">
exports.serveVideoById = async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const gfs = getGFS();

    const file = await gfs.find({ _id: fileId }).toArray();
    if (!file || file.length === 0) {
      return res.status(404).json({ error: "Video not found" });
    }

    res.set("Content-Type", file[0].contentType || "video/mp4");
    const readStream = gfs.openDownloadStream(fileId);
    readStream.pipe(res);
  } catch (error) {
    console.error("Error serving video:", error);
    res.status(500).json({ error: "Error streaming video" });
  }
};

const { extractKeywordsFromQuery } = require('../utils/nlpHelper');

exports.searchTranscripts = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.trim() === '') {
      return res.status(400).json({ error: 'Query is required.' });
    }

    // Step 1: Convert natural language to keywords
    const keywords = await extractKeywordsFromQuery(query);

    // Step 2: Build MongoDB OR search condition
    const searchConditions = keywords.map(kw => ({
      $or: [
        { transcription: { $regex: kw, $options: 'i' } },
        { title: { $regex: kw, $options: 'i' } },
        { tags: { $in: [new RegExp(kw, 'i')] } }
      ]
    }));

    const results = await Video.find({ $or: searchConditions });

    res.json(results);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed.' });
  }
};
