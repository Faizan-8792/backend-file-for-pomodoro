const mongoose = require("mongoose");
const Session = require("../models/Session");
const DailyStat = require("../models/DailyStat");

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

    // IMPORTANT FIX: Convert req.userId (string from JWT) to ObjectId
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

    return res.json({ message: "Session saved" });
  } catch (err) {
    console.error("saveSession error:", err);
    return res.status(500).json({ error: err.message });
  }
};
