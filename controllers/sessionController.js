const Session = require("../models/Session");
const DailyStat = require("../models/DailyStat");

exports.saveSession = async (req, res) => {
  try {
    const { duration, type } = req.body;

    // Keep same behavior: ignore non-focus sessions. [file:59]
    if (type !== "focus") {
      return res.json({ message: "Break session ignored" });
    }

    const safeDuration = Number(duration);

    if (!Number.isFinite(safeDuration) || safeDuration <= 0) {
      return res.status(400).json({ message: "Invalid duration" });
    }

    // Save session (same fields, same req.userId). [file:59]
    await Session.create({
      userId: req.userId,
      duration: Math.floor(safeDuration),
      type,
    });

    // Update daily stats (same date format, same $inc key). [file:59]
    const today = new Date().toISOString().split("T")[0];

    await DailyStat.findOneAndUpdate(
      { userId: req.userId, date: today },
      { $inc: { totalFocusSeconds: Math.floor(safeDuration) } },
      { upsert: true, new: true }
    );

    return res.json({ message: "Session saved" });
  } catch (err) {
    console.error("saveSession error:", err);
    return res.status(500).json({ error: err.message });
  }
};
