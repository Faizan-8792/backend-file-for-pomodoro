const express = require("express");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const LoginCode = require("../models/LoginCode");

const router = express.Router();

function makeCode() {
  return crypto.randomBytes(24).toString("hex"); // 48 chars
}

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"]
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  async (req, res) => {
    try {
      if (!req.user?._id) return res.status(500).send("User missing after auth");

      const code = makeCode();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes

      await LoginCode.create({
        code,
        userId: req.user._id,
        expiresAt
      });

      const BASE_URL = process.env.BASE_URL || "https://backend-file-for-pomodoro.onrender.com";

      // ✅ Hosted page only (never chrome-extension redirect)
      // This avoids ERR_BLOCKED_BY_CLIENT issues.
      return res.redirect(`${BASE_URL}/login-success.html?code=${encodeURIComponent(code)}`);
    } catch (err) {
      console.error("Google login error:", err);
      return res.status(500).send("Authentication failed");
    }
  }
);

module.exports = router;
