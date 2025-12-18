// backend/routes/dashboardRoutes.js
const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/authMiddleware");
const DailyStat = require("../models/DailyStat");

const router = express.Router();

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toISODateLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ✅ DAY: last 7 days (seconds)
router.get("/day", auth, async (req, res) => {
  try {
    const anchor = req.query.date ? new Date(req.query.date) : new Date();
    const start = addDays(anchor, -6);

    const startISO = toISODateLocal(start);
    const endISO = toISODateLocal(anchor);

    const userObjectId = new mongoose.Types.ObjectId(req.userId);

    const docs = await DailyStat.find({
      userId: userObjectId,
      date: { $gte: startISO, $lte: endISO }
    }).sort({ date: 1 });

    const map = new Map(docs.map((d) => [d.date, Number(d.totalFocusSeconds || 0)]));

    const labels = [];
    const values = [];

    for (let i = 6; i >= 0; i--) {
      const d = addDays(anchor, -i);
      const iso = toISODateLocal(d);
      labels.push(iso);

      const seconds = map.get(iso) || 0;
      values.push(seconds > 0 ? seconds : null); // seconds
    }

    return res.json({
      labels,
      values,
      title: "Daily study time (seconds)",
      range: `${startISO} to ${endISO}`
    });
  } catch (err) {
    console.error("day dashboard error:", err);
    return res.status(500).json({ message: "Failed to load day dashboard" });
  }
});

// ✅ WEEK: show last 4 ISO weeks total seconds (NOT average)
router.get("/week", auth, async (req, res) => {
  try {
    const labels = ["Week 1", "Week 2", "Week 3", "Week 4"];
    const values = [null, null, null, null];

    const userObjectId = new mongoose.Types.ObjectId(req.userId);

    const stats = await DailyStat.aggregate([
      { $match: { userId: userObjectId } },
      {
        $addFields: {
          dateObj: { $dateFromString: { dateString: "$date" } }
        }
      },
      {
        $group: {
          _id: {
            y: { $isoWeekYear: "$dateObj" },
            w: { $isoWeek: "$dateObj" }
          },
          totalSeconds: { $sum: "$totalFocusSeconds" }
        }
      },
      { $sort: { "_id.y": 1, "_id.w": 1 } }
    ]);

    const last4 = stats.slice(-4);
    for (let i = 0; i < 4; i++) {
      const row = last4[i];
      if (!row) continue;
      const s = Number(row.totalSeconds || 0);
      values[i] = s > 0 ? s : null; // seconds
    }

    return res.json({
      labels,
      values,
      title: "Weekly total study time (seconds)",
      range: "Last 4 ISO weeks"
    });
  } catch (err) {
    console.error("week dashboard error:", err);
    return res.status(500).json({ message: "Failed to load week dashboard" });
  }
});

// ✅ MONTH (your UI calls this as "year"): totals per month (seconds)
router.get("/month", auth, async (req, res) => {
  try {
    const anchor = req.query.date ? new Date(req.query.date) : new Date();
    const year = anchor.getFullYear();

    const labels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const values = new Array(12).fill(null);

    const userObjectId = new mongoose.Types.ObjectId(req.userId);

    const stats = await DailyStat.aggregate([
      { $match: { userId: userObjectId } },
      {
        $addFields: {
          y: { $toInt: { $substr: ["$date", 0, 4] } },
          m: { $toInt: { $substr: ["$date", 5, 2] } }
        }
      },
      { $match: { y: year } },
      {
        $group: {
          _id: { m: "$m" },
          totalSeconds: { $sum: "$totalFocusSeconds" }
        }
      },
      { $sort: { "_id.m": 1 } }
    ]);

    for (const row of stats) {
      const m = row?._id?.m;
      if (!m || m < 1 || m > 12) continue;
      const s = Number(row.totalSeconds || 0);
      values[m - 1] = s > 0 ? s : null; // seconds
    }

    return res.json({
      labels,
      values,
      title: `Monthly total study time (seconds) - ${year}`,
      range: `Year ${year}`
    });
  } catch (err) {
    console.error("month dashboard error:", err);
    return res.status(500).json({ message: "Failed to load month dashboard" });
  }
});

module.exports = router;
