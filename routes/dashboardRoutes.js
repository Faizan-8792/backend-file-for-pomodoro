// backend/routes/dashboardRoutes.js

const express = require("express");
const auth = require("../middleware/authMiddleware");
const DailyStat = require("../models/DailyStat");

const router = express.Router();

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function monthLabels() {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
}

/* =======================
   GET /api/dashboard/day
======================= */
router.get("/day", auth, async (req, res) => {
  try {
    const anchor = req.query.date ? new Date(req.query.date) : new Date();
    const start = addDays(anchor, -6);

    const startISO = toISODate(start);
    const endISO = toISODate(anchor);

    const docs = await DailyStat.find({
      userId: req.userId,
      date: { $gte: startISO, $lte: endISO },
    }).sort({ date: 1 });

    const secondsByDate = new Map(docs.map((d) => [d.date, d.totalFocusSeconds]));

    const labels = [];
    const values = [];

    for (let i = 6; i >= 0; i--) {
      const d = addDays(anchor, -i);
      const iso = toISODate(d);
      labels.push(iso);

      const seconds = secondsByDate.get(iso) || 0;
      values.push(seconds > 0 ? Number((seconds / 3600).toFixed(2)) : null);
    }

    return res.json({
      labels,
      values,
      title: "Daily hours last 7 days",
      range: `${startISO} to ${endISO}`,
    });
  } catch (err) {
    console.error("day dashboard error", err);
    return res.status(500).json({ message: "Failed to load day dashboard" });
  }
});

/* =======================
   GET /api/dashboard/week
======================= */
router.get("/week", auth, async (req, res) => {
  try {
    const anchor = req.query.date ? new Date(req.query.date) : new Date();
    const anchorISO = toISODate(anchor);

    const labels = ["w1", "w2", "w3", "w4"];
    const values = [null, null, null, null];

    const stats = await DailyStat.aggregate([
      { $match: { userId: req.userId } },
      { $addFields: { dateObj: { $dateFromString: { dateString: "$date" } } } },
      {
        $group: {
          _id: {
            y: { $isoWeekYear: "$dateObj" },
            w: { $isoWeek: "$dateObj" },
          },
          avgSecondsPerDay: { $avg: "$totalFocusSeconds" },
        },
      },
      { $sort: { "_id.y": 1, "_id.w": 1 } },
    ]);

    // Find isoWeekYear+isoWeek for anchor day if that day exists in DB
    const anchorKeyAgg = await DailyStat.aggregate([
      { $match: { userId: req.userId, date: anchorISO } },
      { $addFields: { dateObj: { $dateFromString: { dateString: "$date" } } } },
      { $project: { y: { $isoWeekYear: "$dateObj" }, w: { $isoWeek: "$dateObj" } } },
      { $limit: 1 },
    ]);

    let anchorY = null;
    let anchorW = null;

    if (anchorKeyAgg.length) {
      anchorY = anchorKeyAgg[0].y;
      anchorW = anchorKeyAgg[0].w;
    }

    // Fallback: if anchor day not found, use last 4 available weeks
    if (anchorY === null || anchorW === null) {
      const last4 = stats.slice(-4);
      for (let i = 0; i < 4; i++) {
        const row = last4[i];
        if (!row) continue;
        const hrs = Number(((row.avgSecondsPerDay || 0) / 3600).toFixed(2));
        values[i] = hrs > 0 ? hrs : null;
      }

      return res.json({
        labels,
        values,
        title: "Weekly average hours/day last 4 weeks",
        range: "Last 4 weeks based on available data",
      });
    }

    const targets = [
      { y: anchorY, w: anchorW - 3 },
      { y: anchorY, w: anchorW - 2 },
      { y: anchorY, w: anchorW - 1 },
      { y: anchorY, w: anchorW },
    ];

    const map = new Map(stats.map((r) => [`${r._id.y}-${r._id.w}`, r.avgSecondsPerDay]));

    targets.forEach((t, idx) => {
      const sec = map.get(`${t.y}-${t.w}`) || 0;
      const hrs = Number(((sec || 0) / 3600).toFixed(2));
      values[idx] = hrs > 0 ? hrs : null;
    });

    return res.json({
      labels,
      values,
      title: "Weekly average hours/day last 4 weeks",
      range: `ISO weeks ending near ${anchorISO}`,
    });
  } catch (err) {
    console.error("week dashboard error", err);
    return res.status(500).json({ message: "Failed to load week dashboard" });
  }
});

/* ==================================
   GET /api/dashboard/month (year view)
   GET /api/dashboard/year  (alias)
================================== */
async function handleMonthLike(req, res) {
  try {
    const anchor = req.query.date ? new Date(req.query.date) : new Date();
    const year = anchor.getFullYear();

    const labels = monthLabels();
    const values = new Array(12).fill(null);

    const stats = await DailyStat.aggregate([
      { $match: { userId: req.userId } },
      {
        $addFields: {
          y: { $toInt: { $substr: ["$date", 0, 4] } },
          m: { $toInt: { $substr: ["$date", 5, 2] } },
        },
      },
      { $match: { y: year } },
      { $group: { _id: { m: "$m" }, avgSecondsPerDay: { $avg: "$totalFocusSeconds" } } },
      { $sort: { "_id.m": 1 } },
    ]);

    for (const row of stats) {
      const m = row._id?.m;
      if (!m || m < 1 || m > 12) continue;

      const hrs = Number(((row.avgSecondsPerDay || 0) / 3600).toFixed(2));
      values[m - 1] = hrs > 0 ? hrs : null;
    }

    return res.json({
      labels,
      values,
      title: `Monthly average hours/day ${year}`,
      range: `Year ${year}`,
    });
  } catch (err) {
    console.error("month/year dashboard error", err);
    return res.status(500).json({ message: "Failed to load month dashboard" });
  }
}

router.get("/month", auth, handleMonthLike);
router.get("/year", auth, handleMonthLike);

module.exports = router;
