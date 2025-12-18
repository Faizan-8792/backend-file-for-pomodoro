const express = require("express");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const router = express.Router();

const User = require("../models/User"); // ✅ FIXED

const BASE_URL = (process.env.BASE_URL || "http://localhost:5000").replace(/\/$/, "");

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  async (req, res) => {
    try {
      const dbUser = await User.findById(req.user._id).lean();
      if (!dbUser) return res.status(401).send("User not found");

      const token = jwt.sign({ id: dbUser._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

      const user = {
        id: String(dbUser._id),
        name: dbUser.name,
        email: dbUser.email,
        photo: dbUser.photo,
        currentStreak: dbUser.currentStreak || 0,
        longestStreak: dbUser.longestStreak || 0
      };

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
