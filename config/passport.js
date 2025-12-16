const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const User = require("../models/User");

// ✅ Always use an absolute HTTPS callback URL in production
// Set BASE_URL on Render: https://backend-file-for-pomodoro.onrender.com
const BASE_URL =
  process.env.BASE_URL || "https://backend-file-for-pomodoro.onrender.com";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,

      // IMPORTANT: must match Google Cloud Console Authorized redirect URI exactly
      callbackURL: `${BASE_URL}/auth/google/callback`
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile?.id;
        const name = profile?.displayName || "Google User";
        const email = profile?.emails?.[0]?.value || "";
        const photo = profile?.photos?.[0]?.value || "";

        if (!googleId) {
          return done(new Error("Google profile id missing"), null);
        }

        let user = await User.findOne({ googleId });

        if (!user) {
          user = await User.create({
            googleId,
            name,
            email,
            photo
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

module.exports = passport;
