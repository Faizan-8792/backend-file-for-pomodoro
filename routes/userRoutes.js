const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/authMiddleware");
const User = require("../models/User");

const router = express.Router();

// GET /api/user/streak - Get current user's streak
router.get("/streak", auth, async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.userId);
    const user = await User.findById(userObjectId).select("currentStreak longestStreak lastActiveDate");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      currentStreak: user.currentStreak || 0,
      longestStreak: user.longestStreak || 0,
      lastActiveDate: user.lastActiveDate,
    });
  } catch (err) {
    console.error("Get streak error:", err);
    return res.status(500).json({ message: "Failed to get streak" });
  }
});

module.exports = router;
