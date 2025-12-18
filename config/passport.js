// backend/config/passport.js
require("dotenv").config();

const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

// Use BASE_URL from .env (example: https://backend-file-for-pomodoro.onrender.com)
const BASE_URL = (process.env.BASE_URL || "http://localhost:5000").replace(/\/$/, "");

if (!process.env.GOOGLE_CLIENT_ID) {
  throw new Error("Missing GOOGLE_CLIENT_ID in .env");
}
if (!process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error("Missing GOOGLE_CLIENT_SECRET in .env");
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${BASE_URL}/auth/google/callback`
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile?.id;
        const name = profile?.displayName || "Google User";
        const email = profile?.emails?.[0]?.value || null;
        const photo = profile?.photos?.[0]?.value || null;

        if (!googleId) return done(new Error("Google profile id missing"), null);

        let user = await User.findOne({ googleId });

        if (!user) {
          user = await User.create({
            googleId,
            name,
            email,
            photo
          });
        } else {
          // Keep user info fresh
          const patch = {};
          if (name && user.name !== name) patch.name = name;
          if (email && user.email !== email) patch.email = email;
          if (photo && user.photo !== photo) patch.photo = photo;

          if (Object.keys(patch).length) {
            await User.updateOne({ _id: user._id }, { $set: patch });
            user = await User.findById(user._id);
          }
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

module.exports = passport;
