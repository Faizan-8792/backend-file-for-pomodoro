const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const LoginCode = require("../models/LoginCode");
const User = require("../models/User");

const router = express.Router();

// POST /api/auth/exchange  { code }
router.post("/exchange", async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code || typeof code !== "string") {
      return res.status(400).json({ message: "code is required" });
    }

    const row = await LoginCode.findOne({ code }).lean();
    if (!row) return res.status(404).json({ message: "Invalid code" });

    if (row.usedAt) return res.status(409).json({ message: "Code already used" });

    const now = new Date();
    if (now > new Date(row.expiresAt)) {
      return res.status(410).json({ message: "Code expired" });
    }

    const userId = new mongoose.Types.ObjectId(row.userId);
    const userDoc = await User.findById(userId).lean();
    if (!userDoc) return res.status(404).json({ message: "User not found" });

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "JWT_SECRET missing" });
    }

    const token = jwt.sign({ id: userDoc._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    const user = {
      _id: userDoc._id,
      name: userDoc.name,
      email: userDoc.email,
      photo: userDoc.photo,
      currentStreak: userDoc.currentStreak || 0,
      longestStreak: userDoc.longestStreak || 0
    };

    await LoginCode.updateOne({ code }, { $set: { usedAt: now } });

    return res.json({ token, user });
  } catch (err) {
    console.error("exchange error:", err);
    return res.status(500).json({ message: "Failed to exchange code" });
  }
});

module.exports = router;
