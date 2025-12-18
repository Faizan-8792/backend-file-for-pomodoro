const mongoose = require("mongoose");
const Session = require("../models/Session");
const DailyStat = require("../models/DailyStat");
const User = require("../models/User");

const IST_OFFSET_MIN = 330;

function isoDateIST(d = new Date()) {
  const ist = new Date(d.getTime() + IST_OFFSET_MIN * 60 * 1000);
  return ist.toISOString().slice(0, 10); // YYYY-MM-DD
}

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

    const now = new Date();

    // Save session
    const session = await Session.create({
      userId,
      duration: Math.floor(dur),
      type,
      completedAt: now
    });

    // ✅ Use IST date for daily bucket
    const dateStr = isoDateIST(now);

    await DailyStat.updateOne(
      { userId, date: dateStr },
      { $inc: { totalFocusSeconds: type === "focus" ? Math.floor(dur) : 0 } },
      { upsert: true }
    );

    // Mark not running
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          pomodoroRunning: false,
          pomodoroStartedAt: null,
          lastPomodoroAt: now,
          lastActiveDate: isoDateIST(now)
        }
      }
    );

    return res.json({ message: "Session saved", session });
  } catch (err) {
    console.error("❌ saveSession error:", err);
    return res.status(500).json({ message: "Failed to save session" });
  }
};
