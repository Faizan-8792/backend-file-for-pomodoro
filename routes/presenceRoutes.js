const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/authMiddleware");
const User = require("../models/User");

const router = express.Router();

const IST_OFFSET_MIN = 330;
function isoDateIST(d = new Date()) {
  const ist = new Date(d.getTime() + IST_OFFSET_MIN * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

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
          lastActiveDate: isoDateIST(now)
        }
      }
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("presence start error:", err);
    return res.status(500).json({ message: "Failed to set presence" });
  }
});

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
          lastActiveDate: isoDateIST(now)
        }
      }
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("presence heartbeat error:", err);
    return res.status(500).json({ message: "Failed to update presence" });
  }
});

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
          lastPomodoroAt: now,
          lastActiveDate: isoDateIST(now)
        }
      }
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("presence stop error:", err);
    return res.status(500).json({ message: "Failed to stop presence" });
  }
});

module.exports = router;
