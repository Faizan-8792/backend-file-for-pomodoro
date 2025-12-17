const mongoose = require("mongoose");
const Session = require("../models/Session");
const DailyStat = require("../models/DailyStat");
const User = require("../models/User");

exports.saveSession = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const { duration, type } = req.body;

    if (!duration || !type) {
      return res.status(400).json({ message: "duration and type are required" });
    }

    if (!["focus", "break"].includes(type)) {
      return res.status(400).json({ message: "Invalid type" });
    }

    const dur = Number(duration);
    if (!Number.isFinite(dur) || dur <= 0) {
      return res.status(400).json({ message: "Invalid duration" });
    }

    // Save session
    const session = await Session.create({
      userId,
      duration: Math.floor(dur),
      type,
      completedAt: new Date(),
    });

    // Update daily stats only for focus (optional but recommended)
    const dateStr = new Date().toISOString().split("T")[0];
    await DailyStat.updateOne(
      { userId, date: dateStr },
      { $inc: { totalFocusSeconds: type === "focus" ? Math.floor(dur) : 0 } },
      { upsert: true }
    );

    // ✅ Mark "used pomodoro" and "not running now" after saving session
    const now = new Date();
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          pomodoroRunning: false,
          pomodoroStartedAt: null,
          lastPomodoroAt: now,
          lastActiveDate: now.toISOString().split("T")[0], // legacy
        },
      }
    );

    return res.json({ message: "Session saved", session });
  } catch (err) {
    console.error("❌ saveSession error:", err);
    return res.status(500).json({ message: "Failed to save session" });
  }
};
