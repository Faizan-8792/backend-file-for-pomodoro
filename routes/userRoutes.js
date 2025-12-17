const express = require("express");
const mongoose = require("mongoose");

const auth = require("../middleware/authMiddleware");
const BrowseStat = require("../models/BrowseStat");

const router = express.Router();

/**
 * POST /api/user/browse-ping
 * Body: { domain: "example.com", visitedAt?: ISOString }
 */
router.post("/browse-ping", auth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);

    const domain = String(req.body?.domain || "").trim().toLowerCase();
    if (!domain) return res.status(400).json({ message: "domain is required" });

    const visitedAt = req.body?.visitedAt ? new Date(req.body.visitedAt) : new Date();
    if (Number.isNaN(visitedAt.getTime())) {
      return res.status(400).json({ message: "visitedAt invalid" });
    }

    const now = new Date();

    const updated = await BrowseStat.findOneAndUpdate(
      { userId, domain },
      {
        $inc: { count: 1 },
        $set: { lastVisitedAt: visitedAt, updatedAt: now },
        $setOnInsert: { firstSeenAt: visitedAt, createdAt: now },
      },
      { upsert: true, new: true }
    ).lean();

    return res.json({ ok: true, stat: updated });
  } catch (err) {
    console.error("browse-ping error", err);
    return res.status(500).json({ message: "Failed to save browse ping" });
  }
});

module.exports = router;
