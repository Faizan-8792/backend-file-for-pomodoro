const mongoose = require("mongoose");
const Session = require("../models/Session");
const DailyStat = require("../models/DailyStat");
const User = require("../models/User");

exports.saveSession = async (req, res) => {
  try {
    const { duration, type } = req.body;

    if (type !== "focus") {
      return res.json({ message: "Break session ignored" });
    }

    const safeDuration = Number(duration);
    if (!Number.isFinite(safeDuration) || safeDuration <= 0) {
      return res.status(400).json({ message: "Invalid duration" });
    }

    const userObjectId = new mongoose.Types.ObjectId(req.userId);

    // Save session
    await Session.create({
      userId: userObjectId,
      duration: Math.floor(safeDuration),
      type,
    });

    // Update daily stats
    const today = new Date().toISOString().split("T")[0];
    await DailyStat.findOneAndUpdate(
      { userId: userObjectId, date: today },
      { $inc: { totalFocusSeconds: Math.floor(safeDuration) } },
      { upsert: true, new: true }
    );

    // ✅ NEW: Update streak
    const user = await User.findById(userObjectId);
    if (user) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      if (user.lastActiveDate === today) {
        // Already logged today, no streak change
      } else if (user.lastActiveDate === yesterdayStr) {
        // Consecutive day - increase streak
        user.currentStreak += 1;
        if (user.currentStreak > user.longestStreak) {
          user.longestStreak = user.currentStreak;
        }
        user.lastActiveDate = today;
      } else {
        // Streak broken - reset to 1
        user.currentStreak = 1;
        user.lastActiveDate = today;
      }

      await user.save();
    }

    return res.json({ 
      message: "Session saved",
      streak: user ? user.currentStreak : 0 
    });
  } catch (err) {
    console.error("saveSession error:", err);
    return res.status(500).json({ error: err.message });
  }
};
