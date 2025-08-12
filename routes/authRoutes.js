const express = require('express');
const passport = require('passport');
const router = express.Router();


router.get('/',
    (req, res) => {
       res.status(200).json({ ok: true });
    }
);

// ✅ Start Google OAuth login
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// ✅ Callback after Google login
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        // ✅ Redirect to frontend after successful login
        res.redirect('http://localhost:5173');
    }
);

// ✅ Logout and clear session
router.get('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) return next(err);
        req.session.destroy(() => {
            res.clearCookie('connect.sid'); // Clear session cookie
            res.redirect('http://localhost:5173'); // Redirect to frontend
        });
    });
});

// ✅ Check if user is authenticated
router.get('/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            id: req.user._id,
            googleId: req.user.googleId,
            displayName: req.user.displayName,
            email: req.user.email,
            photo: req.user.photo
        });
    } else {
        res.status(401).json({ message: 'Not logged in' });
    }
});

module.exports = router;
