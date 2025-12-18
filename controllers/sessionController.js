// backend/controllers/sessionController.js
const DailyStat = require("../models/DailyStat"); // adjust if your model name differs
const { isoDateInTimeZone } = require("../utils/date");

async function saveSession(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const durationSeconds = Math.max(0, Number(req.body?.duration || 0));
    const type = String(req.body?.type || "focus");

    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      return res.status(400).json({ message: "Invalid duration" });
    }

    // ✅ Only focus counts
    if (type !== "focus") {
      return res.json({ ok: true, ignored: true });
    }

    // ✅ IST day bucket
    const day = isoDateInTimeZone(new Date(), "Asia/Kolkata");

    await DailyStat.updateOne(
      { userId, date: day },
      { $inc: { totalFocusSeconds: Math.floor(durationSeconds) } },
      { upsert: true }
    );

    return res.json({ ok: true, date: day, addedSeconds: Math.floor(durationSeconds) });
  } catch (err) {
    console.error("saveSession error:", err);
    return res.status(500).json({ message: "Failed to save session" });
  }
}

module.exports = { saveSession };
