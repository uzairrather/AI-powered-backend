const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userModel'); // Import User model
   const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${API_URL}/auth/google/callback` // ✅ Full URL
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // ✅ Check if user exists in DB
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
            // ✅ Create new user if not exists
            user = await User.create({
                googleId: profile.id,
                displayName: profile.displayName,
                email: profile.emails[0].value,
                photo: profile.photos[0].value
            });
        }

        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// ✅ Store only user ID in session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// ✅ Retrieve user from DB using ID
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});
