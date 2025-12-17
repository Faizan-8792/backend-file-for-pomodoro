const express = require("express");
const passport = require("passport");
const jwt = require("jsonwebtoken");

const router = express.Router();

/**
 * @route GET /auth/google
 * @desc Start Google OAuth
 */
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

/**
 * @route GET /auth/google/callback
 * @desc Google OAuth callback
 */
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  (req, res) => {
    try {
      const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      // ✅ Include streak fields so popup can show 🔥 x N
      const user = {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        photo: req.user.photo,

        // streaks
        currentStreak: req.user.currentStreak || 0,
        longestStreak: req.user.longestStreak || 0,
      };

      const BASE_URL =
        process.env.BASE_URL || "https://backend-file-for-pomodoro.onrender.com";

      const redirectUrl =
        `${BASE_URL}/auth-success.html` +
        `?token=${encodeURIComponent(token)}` +
        `&user=${encodeURIComponent(JSON.stringify(user))}`;

      return res.redirect(redirectUrl);
    } catch (err) {
      console.error("Google login error:", err);
      return res.status(500).send("Authentication failed");
    }
  }
);

module.exports = router;
