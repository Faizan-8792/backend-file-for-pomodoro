const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/authMiddleware");
const User = require("../models/User");

const router = express.Router();

/**
 * POST /api/presence/start
 * Marks user as currently running pomodoro.
 */
router.post("/start", auth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const now = new Date();

    await User.updateOne(
      { _id: userId },
      {
        $set: {
          pomodoroRunning: true,
          pomodoroStartedAt: now,
          lastPomodoroAt: now,
          lastActiveDate: now.toISOString().split("T")[0], // legacy
        },
      }
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("presence start error:", err);
    return res.status(500).json({ message: "Failed to set presence" });
  }
});

/**
 * POST /api/presence/heartbeat
 * Keeps user active while timer is running.
 */
router.post("/heartbeat", auth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const now = new Date();

    await User.updateOne(
      { _id: userId },
      {
        $set: {
          pomodoroRunning: true,
          lastPomodoroAt: now,
          lastActiveDate: now.toISOString().split("T")[0], // legacy
        },
      }
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("presence heartbeat error:", err);
    return res.status(500).json({ message: "Failed to update presence" });
  }
});

/**
 * POST /api/presence/stop
 * Marks user not active (not running).
 */
router.post("/stop", auth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    const now = new Date();

    await User.updateOne(
      { _id: userId },
      {
        $set: {
          pomodoroRunning: false,
          pomodoroStartedAt: null,
          lastPomodoroAt: now, // they used pomodoro recently
          lastActiveDate: now.toISOString().split("T")[0], // legacy
        },
      }
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("presence stop error:", err);
    return res.status(500).json({ message: "Failed to stop presence" });
  }
});

module.exports = router;
