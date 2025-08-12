const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');
const { initGridFS } = require('./utils/gridfs');
const session = require('express-session');
const passport = require('passport');
require('./config/passport'); // Google OAuth Strategy

const videoRoutes = require('./routes/videoRoutes');
const storyRoutes = require('./routes/storyRoutes');
const authRoutes = require('./routes/authRoutes'); // ✅ New route for Google OAuth

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Session & Passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecretkey',
  resave: false,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

// Connect DB and initialize GridFS
connectDB()
  .then((connection) => {
    initGridFS(connection); // ✅ GridFS initialized after DB is ready

    // Routes
    app.use('/api/videos', videoRoutes);
    app.use('/api/stories', storyRoutes);
    app.use('/auth', authRoutes); // ✅ Google OAuth routes

    // Start server
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB', err);
    process.exit(1);
  });

module.exports = app;
