const express = require("express");
const mongoose = require("mongoose");

const auth = require("../middleware/authMiddleware");

const User = require("../models/User");
const Session = require("../models/Session");
const DailyStat = require("../models/DailyStat");
const BrowseStat = require("../models/BrowseStat"); // NEW

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

    return next();
  } catch (err) {
    console.error("Admin check failed:", err);
    return res.status(500).json({ message: "Admin check failed" });
  }
};

// ------------------------------
// helpers
// ------------------------------
function computeStatusFromLastActiveAt(lastActiveAt) {
  if (!lastActiveAt) {
    return { status: "Dormant", minutesSinceLastActive: null };
  }

  const ms = Date.now() - new Date(lastActiveAt).getTime();
  const minutes = Math.floor(ms / (1000 * 60));

  let status = "Dormant";
  if (minutes <= 2) status = "Active";
  else if (minutes <= 20) status = "Recently Active";
  else if (minutes <= 60 * 24 * 30) status = "Inactive"; // up to ~1 month
  else status = "Dormant";

  return { status, minutesSinceLastActive: minutes };
}

// ===================================
// 📊 PLATFORM OVERVIEW STATS
// ===================================
router.get("/stats", auth, isAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalSessions = await Session.countDocuments();

    const totalFocusTime = await Session.aggregate([
      { $match: { type: "focus" } },
      { $group: { _id: null, total: { $sum: "$duration" } } },
    ]);

    const totalBreakTime = await Session.aggregate([
      { $match: { type: "break" } },
      { $group: { _id: null, total: { $sum: "$duration" } } },
    ]);

    // legacy counts based on lastActiveDate string (kept)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeUsers7d = await User.countDocuments({
      lastActiveDate: { $gte: sevenDaysAgo.toISOString().split("T")[0] },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsers30d = await User.countDocuments({
      lastActiveDate: { $gte: thirtyDaysAgo.toISOString().split("T")[0] },
    });

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const newUsersWeek = await User.countDocuments({ createdAt: { $gte: oneWeekAgo } });

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const newUsersMonth = await User.countDocuments({ createdAt: { $gte: oneMonthAgo } });

    const avgSessionDuration = await Session.aggregate([
      { $match: { type: "focus" } },
      { $group: { _id: null, avg: { $avg: "$duration" } } },
    ]);

    const peakHour = await Session.aggregate([
      { $group: { _id: { $hour: "$completedAt" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
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
      peakUsageHour: peakHour[0]?._id ?? null,
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

        const totalSessions = await Session.countDocuments({ userId });

        const totalFocusTime = await Session.aggregate([
          { $match: { userId, type: "focus" } },
          { $group: { _id: null, total: { $sum: "$duration" } } },
        ]);

        const totalBreakTime = await Session.aggregate([
          { $match: { userId, type: "break" } },
          { $group: { _id: null, total: { $sum: "$duration" } } },
        ]);

        const avgDuration = await Session.aggregate([
          { $match: { userId, type: "focus" } },
          { $group: { _id: null, avg: { $avg: "$duration" } } },
        ]);

        const lastSession = await Session.findOne({ userId })
          .sort({ completedAt: -1 })
          .select("completedAt duration type")
          .lean();

        const firstSession = await Session.findOne({ userId })
          .sort({ completedAt: 1 })
          .select("completedAt")
          .lean();

        const activeDays = await DailyStat.countDocuments({ userId });

        // ✅ NEW: minute-level status based on lastActiveAt (Date)
        const { status, minutesSinceLastActive } = computeStatusFromLastActiveAt(user.lastActiveAt);

        // Keep old daysSinceLastActive (optional; helps UI fallback)
        let daysSinceLastActive = null;
        if (user.lastActiveDate) {
          const lastDate = new Date(user.lastActiveDate);
          const today = new Date();
          daysSinceLastActive = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
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

            // NEW fields for UI
            status,
            minutesSinceLastActive,

            // Optional legacy field
            daysSinceLastActive,

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
// 🔍 INDIVIDUAL USER DETAILS (+ browsing)
// ===================================
router.get("/user/:userId", auth, isAdmin, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.userId);

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const sessions = await Session.find({ userId }).sort({ completedAt: -1 }).limit(100).lean();
    const dailyStats = await DailyStat.find({ userId }).sort({ date: -1 }).lean();

    const topSites = await BrowseStat.find({ userId })
      .sort({ count: -1, lastVisitedAt: -1 })
      .limit(10)
      .select("domain count lastVisitedAt")
      .lean();

    const lastSite = await BrowseStat.findOne({ userId })
      .sort({ lastVisitedAt: -1 })
      .select("domain lastVisitedAt")
      .lean();

    return res.json({
      user,
      sessions,
      dailyStats,
      browsing: {
        lastSite: lastSite || null,
        topSites: topSites || [],
      },
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

    const byFocusTime = [...usersWithStats]
      .sort((a, b) => b.totalFocusSeconds - a.totalFocusSeconds)
      .slice(0, 10)
      .map((u) => ({ ...u, totalFocusHours: (u.totalFocusSeconds / 3600).toFixed(2) }));

    const bySessions = [...usersWithStats].sort((a, b) => b.totalSessions - a.totalSessions).slice(0, 10);
    const byStreak = [...usersWithStats].sort((a, b) => b.currentStreak - a.currentStreak).slice(0, 10);

    return res.json({ topByFocusTime: byFocusTime, topBySessions: bySessions, topByStreak: byStreak });
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

    const sessionsPerDay = await Session.aggregate([
      { $match: { completedAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } },
          count: { $sum: 1 },
          totalDuration: { $sum: "$duration" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const newUsersPerDay = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return res.json({ sessionsPerDay, newUsersPerDay });
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
    const sessionsByHour = await Session.aggregate([
      { $group: { _id: { $hour: "$completedAt" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const sessionsByDayOfWeek = await Session.aggregate([
      {
        $group: {
          _id: { $dayOfWeek: "$completedAt" },
          count: { $sum: 1 },
          avgDuration: { $avg: "$duration" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const typeDistribution = await Session.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          totalDuration: { $sum: "$duration" },
        },
      },
    ]);

    return res.json({ sessionsByHour, sessionsByDayOfWeek, typeDistribution });
  } catch (err) {
    console.error("❌ Session analytics error:", err);
    return res.status(500).json({ message: "Failed to fetch session analytics" });
  }
});

module.exports = router;
