// backend/routes/authRoutes.js
const express = require('express');
const passport = require('passport');

const router = express.Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Health/ready
router.get('/', (_req, res) => res.status(200).json({ ok: true }));

// Start Google OAuth
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Optional failure route (nice UX)
router.get('/failure', (_req, res) => {
  res.redirect(`${FRONTEND_URL}/login?auth=failure`);
});

// Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${FRONTEND_URL}/login?auth=failure`,
    session: true,
  }),
  (req, res) => {
    // Success → send the user back to the frontend (Vercel)
    res.redirect(FRONTEND_URL);
  }
);

// Logout & clear session cookie
router.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    req.session.destroy(() => {
      // Must match the cookie name from app.js (name: 'sid')
      res.clearCookie('sid', { path: '/' });
      res.redirect(FRONTEND_URL);
    });
  });
});


module.exports = router;
