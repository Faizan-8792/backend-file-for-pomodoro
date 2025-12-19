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
    day: "2-digit",
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// ✅ Normalize any incoming duration to SECONDS safely
// NOW: always treat input as SECONDS
function normalizeDurationToSeconds(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;

  // Treat as seconds directly
  const seconds = Math.round(n);

  // Hard safety cap: max 12 hours per saved session
  if (seconds > 12 * 3600) return null;

  return seconds;
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

    const seconds = normalizeDurationToSeconds(duration);
    if (!seconds) {
      return res.status(400).json({ message: "Invalid duration (expected seconds)" });
    }

    const session = await Session.create({
      userId,
      duration: seconds, // ✅ store seconds only
      type,
      completedAt: new Date(),
    });

    const dayIST = isoDateIST(new Date());

    await DailyStat.updateOne(
      { userId, date: dayIST },
      { $inc: { totalFocusSeconds: type === "focus" ? seconds : 0 } },
      { upsert: true }
    );

    const now = new Date();
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          pomodoroRunning: false,
          pomodoroStartedAt: null,
          lastPomodoroAt: now,
          lastActiveDate: dayIST,
        },
      }
    );

    return res.json({ message: "Session saved", session, normalizedSeconds: seconds });
  } catch (err) {
    console.error("❌ saveSession error:", err);
    return res.status(500).json({ message: "Failed to save session" });
  }
};
