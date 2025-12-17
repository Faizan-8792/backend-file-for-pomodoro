const express = require("express");
const mongoose = require("mongoose");
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

/**
 * DAY: last 7 days ending at ?date
 */
router.get("/day", auth, async (req, res) => {
  try {
    const anchor = req.query.date ? new Date(req.query.date) : new Date();
    const start = addDays(anchor, -6);

    const startISO = toISODate(start);
    const endISO = toISODate(anchor);

    const userObjectId = new mongoose.Types.ObjectId(req.userId);

    const docs = await DailyStat.find({
      userId: userObjectId,
      date: { $gte: startISO, $lte: endISO },
    }).sort({ date: 1 });

    const map = new Map(docs.map((d) => [d.date, d.totalFocusSeconds]));

    const labels = [];
    const values = [];

    for (let i = 6; i >= 0; i--) {
      const d = addDays(anchor, -i);
      const iso = toISODate(d);

      labels.push(iso);

      const seconds = map.get(iso) || 0;
      values.push(seconds > 0 ? Number((seconds / 3600).toFixed(2)) : null);
    }

    return res.json({
      labels,
      values,
      title: "Daily hours (7 days)",
      range: `${startISO} to ${endISO}`,
    });
  } catch (err) {
    console.error("day dashboard error:", err);
    return res.status(500).json({ message: "Failed to load day dashboard" });
  }
});

/**
 * WEEK: last 4 ISO weeks ending at ?date
 */
router.get("/week", auth, async (req, res) => {
  try {
    const anchor = req.query.date ? new Date(req.query.date) : new Date();

    const labels = ["w1", "w2", "w3", "w4"];
    const values = [null, null, null, null];

    const userObjectId = new mongoose.Types.ObjectId(req.userId);

    const stats = await DailyStat.aggregate([
      { $match: { userId: userObjectId } },
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

    const anchorISO = toISODate(anchor);

    const anchorKeyAgg = await DailyStat.aggregate([
      { $match: { userId: userObjectId, date: anchorISO } },
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
        title: "Weekly avg hours/day (last 4 weeks)",
        range: "Last 4 weeks (based on available data)",
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
      const hrs = Number((sec / 3600).toFixed(2));
      values[idx] = hrs > 0 ? hrs : null;
    });

    return res.json({
      labels,
      values,
      title: "Weekly avg hours/day (last 4 weeks)",
      range: `ISO weeks ending near ${toISODate(anchor)}`,
    });
  } catch (err) {
    console.error("week dashboard error:", err);
    return res.status(500).json({ message: "Failed to load week dashboard" });
  }
});

/**
 * MONTH: 12 months for anchor year
 */
router.get("/month", auth, async (req, res) => {
  try {
    const anchor = req.query.date ? new Date(req.query.date) : new Date();
    const year = anchor.getFullYear();

    const labels = Array.from({ length: 12 }, (_, i) => `m${i + 1}`);
    const values = new Array(12).fill(null);

    const userObjectId = new mongoose.Types.ObjectId(req.userId);

    const stats = await DailyStat.aggregate([
      { $match: { userId: userObjectId } },
      {
        $addFields: {
          y: { $toInt: { $substr: ["$date", 0, 4] } },
          m: { $toInt: { $substr: ["$date", 5, 2] } },
        },
      },
      { $match: { y: year } },
      {
        $group: {
          _id: { m: "$m" },
          avgSecondsPerDay: { $avg: "$totalFocusSeconds" },
        },
      },
      { $sort: { "_id.m": 1 } },
    ]);

    for (const row of stats) {
      const m = row._id.m;
      if (!m || m < 1 || m > 12) continue;
      const hrs = Number(((row.avgSecondsPerDay || 0) / 3600).toFixed(2));
      values[m - 1] = hrs > 0 ? hrs : null;
    }

    return res.json({
      labels,
      values,
      title: `Monthly avg hours/day (${year})`,
      range: `Year ${year}`,
    });
  } catch (err) {
    console.error("month dashboard error:", err);
    return res.status(500).json({ message: "Failed to load month dashboard" });
  }
});

module.exports = router;
