const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/authMiddleware");
const User = require("../models/User");
const Session = require("../models/Session");
const DailyStat = require("../models/DailyStat");

const router = express.Router();

const ADMIN_EMAIL = "saifullahfaizan786@gmail.com";

// Admin middleware
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

// ===================================
// 📊 PLATFORM OVERVIEW STATS
// ===================================
router.get("/stats", auth, isAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalSessions = await Session.countDocuments();
    
    // Total focus time
    const totalFocusTime = await Session.aggregate([
      { $match: { type: "focus" } },
      { $group: { _id: null, total: { $sum: "$duration" } } },
    ]);

    // Total break time
    const totalBreakTime = await Session.aggregate([
      { $match: { type: "break" } },
      { $group: { _id: null, total: { $sum: "$duration" } } },
    ]);

    // Active users (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeUsers7d = await User.countDocuments({
      lastActiveDate: { $gte: sevenDaysAgo.toISOString().split("T")[0] }
    });

    // Active users (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsers30d = await User.countDocuments({
      lastActiveDate: { $gte: thirtyDaysAgo.toISOString().split("T")[0] }
    });

    // New users this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const newUsersWeek = await User.countDocuments({
      createdAt: { $gte: oneWeekAgo }
    });

    // New users this month
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const newUsersMonth = await User.countDocuments({
      createdAt: { $gte: oneMonthAgo }
    });

    // Average session duration
    const avgSessionDuration = await Session.aggregate([
      { $match: { type: "focus" } },
      { $group: { _id: null, avg: { $avg: "$duration" } } }
    ]);

    // Peak usage hour
    const peakHour = await Session.aggregate([
      {
        $group: {
          _id: { $hour: "$timestamp" },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);

    return res.json({
      totalUsers,
      totalSessions,
      totalFocusSeconds: totalFocusTime[0]?.total || 0,
      totalFocusHours: ((totalFocusTime[0]?.total || 0) / 3600).toFixed(2),
      totalBreakSeconds: totalBreakTime[0]?.total || 0,
      totalBreakHours: ((totalBreakTime[0]?.total || 0) / 3600).toFixed(2),
      activeUsers7d,
      activeUsers30d,
      newUsersWeek,
      newUsersMonth,
      avgSessionMinutes: ((avgSessionDuration[0]?.avg || 0) / 60).toFixed(2),
      peakUsageHour: peakHour[0]?._id || null,
    });
  } catch (err) {
    console.error("❌ Admin stats error:", err);
    return res.status(500).json({ message: "Failed to fetch stats" });
  }
});

// ===================================
// 👥 ALL USERS WITH ENHANCED STATS
// ===================================
router.get("/users", auth, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}).lean();

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

        // Total break time
        const totalBreakTime = await Session.aggregate([
          { $match: { userId, type: "break" } },
          { $group: { _id: null, total: { $sum: "$duration" } } },
        ]);

        // Average session duration
        const avgDuration = await Session.aggregate([
          { $match: { userId, type: "focus" } },
          { $group: { _id: null, avg: { $avg: "$duration" } } },
        ]);

        // Last session
        const lastSession = await Session.findOne({ userId })
          .sort({ timestamp: -1 })
          .select("timestamp duration type")
          .lean();

        // First session
        const firstSession = await Session.findOne({ userId })
          .sort({ timestamp: 1 })
          .select("timestamp")
          .lean();

        // Active days
        const activeDays = await DailyStat.countDocuments({ userId });

        // Days since last activity
        let daysSinceLastActive = null;
        if (user.lastActiveDate) {
          const lastDate = new Date(user.lastActiveDate);
          const today = new Date();
          daysSinceLastActive = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
        }

        // User status
        let status = "Inactive";
        if (daysSinceLastActive !== null) {
          if (daysSinceLastActive <= 1) status = "Active";
          else if (daysSinceLastActive <= 7) status = "Recently Active";
          else if (daysSinceLastActive <= 30) status = "Inactive";
          else status = "Dormant";
        }

        return {
          ...user,
          stats: {
            totalSessions,
            totalFocusSeconds: totalFocusTime[0]?.total || 0,
            totalFocusHours: ((totalFocusTime[0]?.total || 0) / 3600).toFixed(2),
            totalBreakSeconds: totalBreakTime[0]?.total || 0,
            totalBreakHours: ((totalBreakTime[0]?.total || 0) / 3600).toFixed(2),
            avgSessionMinutes: ((avgDuration[0]?.avg || 0) / 60).toFixed(2),
            activeDays,
            lastSession: lastSession || null,
            firstSession: firstSession || null,
            daysSinceLastActive,
            status,
            currentStreak: user.currentStreak || 0,
            longestStreak: user.longestStreak || 0,
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

// ===================================
// 🔍 INDIVIDUAL USER DETAILS
// ===================================
router.get("/user/:userId", auth, isAdmin, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.userId);

    const user = await User.findById(userId).lean();
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

// ===================================
// 🏆 LEADERBOARDS
// ===================================
router.get("/leaderboard", auth, isAdmin, async (req, res) => {
  try {
    const users = await User.find({}).lean();

    // Get stats for all users
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const userId = user._id;

        const totalFocusTime = await Session.aggregate([
          { $match: { userId, type: "focus" } },
          { $group: { _id: null, total: { $sum: "$duration" } } },
        ]);

        const totalSessions = await Session.countDocuments({ userId });

        return {
          _id: user._id,
          name: user.name,
          email: user.email,
          totalFocusSeconds: totalFocusTime[0]?.total || 0,
          totalSessions,
          currentStreak: user.currentStreak || 0,
          longestStreak: user.longestStreak || 0,
        };
      })
    );

    // Sort by focus time
    const byFocusTime = [...usersWithStats]
      .sort((a, b) => b.totalFocusSeconds - a.totalFocusSeconds)
      .slice(0, 10)
      .map(u => ({
        ...u,
        totalFocusHours: (u.totalFocusSeconds / 3600).toFixed(2)
      }));

    // Sort by sessions
    const bySessions = [...usersWithStats]
      .sort((a, b) => b.totalSessions - a.totalSessions)
      .slice(0, 10);

    // Sort by current streak
    const byStreak = [...usersWithStats]
      .sort((a, b) => b.currentStreak - a.currentStreak)
      .slice(0, 10);

    return res.json({
      topByFocusTime: byFocusTime,
      topBySessions: bySessions,
      topByStreak: byStreak,
    });
  } catch (err) {
    console.error("❌ Leaderboard error:", err);
    return res.status(500).json({ message: "Failed to fetch leaderboard" });
  }
});

// ===================================
// 📅 ACTIVITY TIMELINE (LAST 30 DAYS)
// ===================================
router.get("/timeline", auth, isAdmin, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const today = new Date();

    // Sessions per day
    const sessionsPerDay = await Session.aggregate([
      { $match: { timestamp: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
          },
          count: { $sum: 1 },
          totalDuration: { $sum: "$duration" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // New users per day
    const newUsersPerDay = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return res.json({
      sessionsPerDay,
      newUsersPerDay,
    });
  } catch (err) {
    console.error("❌ Timeline error:", err);
    return res.status(500).json({ message: "Failed to fetch timeline" });
  }
});

// ===================================
// 📊 SESSION ANALYTICS
// ===================================
router.get("/session-analytics", auth, isAdmin, async (req, res) => {
  try {
    // Sessions by hour of day
    const sessionsByHour = await Session.aggregate([
      {
        $group: {
          _id: { $hour: "$timestamp" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Sessions by day of week
    const sessionsByDayOfWeek = await Session.aggregate([
      {
        $group: {
          _id: { $dayOfWeek: "$timestamp" },
          count: { $sum: 1 },
          avgDuration: { $avg: "$duration" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Focus vs Break distribution
    const typeDistribution = await Session.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          totalDuration: { $sum: "$duration" }
        }
      }
    ]);

    return res.json({
      sessionsByHour,
      sessionsByDayOfWeek,
      typeDistribution,
    });
  } catch (err) {
    console.error("❌ Session analytics error:", err);
    return res.status(500).json({ message: "Failed to fetch session analytics" });
  }
});

module.exports = router;
