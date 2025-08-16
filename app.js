// backend/app.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') }); // load env first

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
const isProd = process.env.NODE_ENV === 'production';

// Trust proxy (Render) so secure cookies work
app.set('trust proxy', 1);

// ---- CORS (explicit origins + credentials) ----
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL, // e.g. https://your-frontend.vercel.app
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// ---- Body parsers ----
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// ---- Session & Passport (cross-site cookie for Vercel domain) ----
app.use(
  session({
    name: 'sid', // cookie name; match logout clearCookie('sid')
    secret: process.env.SESSION_SECRET || 'supersecretkey',
    resave: false,
    saveUninitialized: false, // don't create empty sessions
    proxy: true, // honor trust proxy for secure cookies
    cookie: {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      secure: isProd,                  // true on Render (HTTPS)
      sameSite: isProd ? 'none' : 'lax', // allow cross-site cookie in prod
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// ---- Health check (Render uses this) ----
app.get('/healthz', (_req, res) => res.status(200).send('OK'));

// ---- Optional: alias if the frontend calls /user instead of /auth/user ----
app.get('/user', (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Not logged in' });
  res.json({
    id: req.user._id,
    googleId: req.user.googleId,
    displayName: req.user.displayName,
    email: req.user.email,
    photo: req.user.photo,
  });
});

// ---- DB + GridFS + routes ----
connectDB()
  .then((connection) => {
    initGridFS(connection);

    app.use('/api/videos', videoRoutes);
    app.use('/api/stories', storyRoutes);
    app.use('/auth', authRoutes);

    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`✅ Allowed CORS origins: ${allowedOrigins.join(', ')}`);
      console.log(`✅ NODE_ENV: ${process.env.NODE_ENV}`);
      console.log(`✅ FRONTEND_URL: ${process.env.FRONTEND_URL}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB', err);
    process.exit(1);
  });

module.exports = app;
