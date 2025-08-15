const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') }); // ✅ load env first

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');

const connectDB = require('./config/db');
const { initGridFS } = require('./utils/gridfs');
require('./config/passport'); // Google OAuth Strategy

const videoRoutes = require('./routes/videoRoutes');
const storyRoutes = require('./routes/storyRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust Render proxy (for secure cookies if you enable them)
app.set('trust proxy', 1);

// ---- CORS (env-driven) ----
const allowedOrigins = [
  'https://ai-powered-frontend.vercel.app/',
  process.env.FRONTEND_URL,                 // e.g. https://your-frontend.vercel.app
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// ---- Basic middleware ----
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// ---- Session & Passport ----
app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecretkey',
  resave: false,
  saveUninitialized: true,
  // cookie: { secure: true, sameSite: 'none' } // uncomment when you use HTTPS + cookies across domains
}));
app.use(passport.initialize());
app.use(passport.session());

// ---- Health check (Render uses this) ----
app.get('/healthz', (_req, res) => res.status(200).send('OK'));

// ---- DB + GridFS + routes ----
connectDB()
  .then((connection) => {
    initGridFS(connection);

    app.use('/api/videos', videoRoutes);
    app.use('/api/stories', storyRoutes);
    app.use('/auth', authRoutes);

    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB', err);
    process.exit(1);
  });

module.exports = app;
