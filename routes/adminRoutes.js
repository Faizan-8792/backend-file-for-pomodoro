const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/authMiddleware");
const User = require("../models/User");
const Session = require("../models/Session");
const DailyStat = require("../models/DailyStat");

const router = express.Router();

const ADMIN_EMAIL = "saifullahfaizan786@gmail.com";

// Admin middleware - checks if logged-in user is admin
const isAdmin = async (req, res, next) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.userId);
    const user = await User.findById(userObjectId);
    
    if (!user || user.email !== ADMIN_EMAIL) {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }
    
    next();
  } catch (err) {
    return res.status(500).json({ message: "Admin check failed" });
  }
};

// GET /api/admin/users - Get all users with stats
router.get("/users", auth, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}).select("-__v").lean();

    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const userId = user._id;

        // Total sessions
        const totalSessions = await Session.countDocuments({ userId });

        // Total focus time
        const totalFocusTime = await Session.aggregate([
          { $match: { userId, type: "focus" } },
          { $group: { _id: null, total: { $sum: "$duration" } } },
        ]);

        // Last session
        const lastSession = await Session.findOne({ userId })
          .sort({ timestamp: -1 })
          .select("timestamp duration type")
          .lean();

        // Total days active
        const activeDays = await DailyStat.countDocuments({ userId });

        return {
          ...user,
          stats: {
            totalSessions,
            totalFocusSeconds: totalFocusTime[0]?.total || 0,
            totalFocusHours: ((totalFocusTime[0]?.total || 0) / 3600).toFixed(2),
            activeDays,
            lastSession: lastSession || null,
          },
        };
      })
    );

    return res.json({ users: usersWithStats });
  } catch (err) {
    console.error("❌ Admin users fetch error:", err);
    return res.status(500).json({ message: "Failed to fetch users" });
  }
});

// GET /api/admin/user/:userId - Get detailed user data
router.get("/user/:userId", auth, isAdmin, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.userId);

    const user = await User.findById(userId).select("-__v").lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // All sessions
    const sessions = await Session.find({ userId })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    // All daily stats
    const dailyStats = await DailyStat.find({ userId })
      .sort({ date: -1 })
      .lean();

    return res.json({
      user,
      sessions,
      dailyStats,
    });
  } catch (err) {
    console.error("❌ Admin user detail error:", err);
    return res.status(500).json({ message: "Failed to fetch user details" });
  }
});

// GET /api/admin/stats - Overall platform stats
router.get("/stats", auth, isAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalSessions = await Session.countDocuments();
    const totalFocusTime = await Session.aggregate([
      { $match: { type: "focus" } },
      { $group: { _id: null, total: { $sum: "$duration" } } },
    ]);

    const recentUsers = await User.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name email createdAt")
      .lean();

    return res.json({
      totalUsers,
      totalSessions,
      totalFocusSeconds: totalFocusTime[0]?.total || 0,
      totalFocusHours: ((totalFocusTime[0]?.total || 0) / 3600).toFixed(2),
      recentUsers,
    });
  } catch (err) {
    console.error("❌ Admin stats error:", err);
    return res.status(500).json({ message: "Failed to fetch stats" });
  }
});

module.exports = router;
