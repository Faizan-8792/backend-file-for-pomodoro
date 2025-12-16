const express = require("express");
const passport = require("passport");
const jwt = require("jsonwebtoken");

const router = express.Router();

/**
 * @route   GET /auth/google
 * @desc    Start Google OAuth
 */
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

/**
 * @route   GET /auth/google/callback
 * @desc    Google OAuth callback
 */
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  (req, res) => {
    try {
      // Keep same token payload shape + same env var name used here. [file:48]
      const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      const user = {
        name: req.user.name,
        email: req.user.email,
        photo: req.user.photo,
      };

      // Keep same redirect behavior to local success page (not extension). [file:48]
      const redirectUrl =
        "http://localhost:5000/auth-success.html" +
        `?token=${encodeURIComponent(token)}` +
        `&user=${encodeURIComponent(JSON.stringify(user))}`;

      res.redirect(redirectUrl);
    } catch (err) {
      console.error("Google login error:", err);
      res.status(500).send("Authentication failed");
    }
  }
);

module.exports = router;
