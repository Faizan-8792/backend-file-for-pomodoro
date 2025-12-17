const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },

    // ✅ Streak tracking
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },

    // ✅ Pomodoro presence tracking (for admin status)
    pomodoroRunning: { type: Boolean, default: false },
    pomodoroStartedAt: { type: Date, default: null },   // when current run started
    lastPomodoroAt: { type: Date, default: null },      // last time user started/used pomodoro

    // (Optional) keep old field to not break old UI pages
    lastActiveDate: { type: String, default: null }, // legacy YYYY-MM-DD
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
