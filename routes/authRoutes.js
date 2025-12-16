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

      const user = {
        name: req.user.name,
        email: req.user.email,
        photo: req.user.photo,
      };

      // ✅ FIX: Use deployed base URL instead of localhost
      // Set BASE_URL on Render: https://backend-file-for-pomodoro.onrender.com
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
