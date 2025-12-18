// backend/controllers/sessionController.js
const mongoose = require("mongoose");
const Session = require("../models/Session");
const DailyStat = require("../models/DailyStat");
const User = require("../models/User");

// ✅ YYYY-MM-DD in IST
function isoDateIST(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

exports.saveSession = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);

    const { duration, type } = req.body;

    if (duration === undefined || type === undefined) {
      return res.status(400).json({ message: "duration and type are required" });
    }

    if (!["focus", "break"].includes(type)) {
      return res.status(400).json({ message: "Invalid type" });
    }

    const dur = Number(duration);
    if (!Number.isFinite(dur) || dur <= 0) {
      return res.status(400).json({ message: "Invalid duration" });
    }

    const session = await Session.create({
      userId,
      duration: Math.floor(dur),
      type,
      completedAt: new Date()
    });

    // ✅ correct IST day bucket
    const dayIST = isoDateIST(new Date());

    // ✅ only focus counts in study stats
    if (type === "focus") {
      await DailyStat.updateOne(
        { userId, date: dayIST },
        { $inc: { totalFocusSeconds: Math.floor(dur) } },
        { upsert: true }
      );
    }

    const now = new Date();
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          pomodoroRunning: false,
          pomodoroStartedAt: null,
          lastPomodoroAt: now,
          lastActiveDate: dayIST
        }
      }
    );

    return res.json({ message: "Session saved", session, day: dayIST });
  } catch (err) {
    console.error("saveSession error:", err);
    return res.status(500).json({ message: "Failed to save session" });
  }
};
