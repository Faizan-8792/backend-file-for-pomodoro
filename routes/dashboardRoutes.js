const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/authMiddleware");
const DailyStat = require("../models/DailyStat");

const router = express.Router();

const IST_OFFSET_MIN = 330;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function isoDateISTFromDateObj(d) {
  const ist = new Date(d.getTime() + IST_OFFSET_MIN * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

// Parse "YYYY-MM-DD" safely (avoid JS Date UTC shift)
function parseISODateOnly(iso) {
  if (!iso || typeof iso !== "string") return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // Create a Date at UTC midnight; then we will convert via IST helpers where needed
  return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0));
}

function addDays(dateObj, days) {
  const d = new Date(dateObj);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// /api/dashboard/day - Last 7 days (FOCUS MINUTES)
router.get("/day", auth, async (req, res) => {
  try {
    const anchorRaw = req.query.date ? parseISODateOnly(req.query.date) : null;
    const anchor = anchorRaw || new Date(); // fallback now

    // Build 7-day range in IST date strings
    const start = addDays(anchor, -6);

    const startISO = isoDateISTFromDateObj(start);
    const endISO = isoDateISTFromDateObj(anchor);

    const userObjectId = new mongoose.Types.ObjectId(req.userId);

    const docs = await DailyStat.find({
      userId: userObjectId,
      date: { $gte: startISO, $lte: endISO }
    }).sort({ date: 1 });

    const map = new Map(docs.map((d) => [d.date, d.totalFocusSeconds]));

    const labels = [];
    const values = [];

    for (let i = 6; i >= 0; i--) {
      const d = addDays(anchor, -i);
      const iso = isoDateISTFromDateObj(d);

      labels.push(iso);
      const seconds = map.get(iso) || 0;

      // ✅ minutes (integer). Use null for 0 so chart gaps stay clean
      values.push(seconds > 0 ? Math.round(seconds / 60) : null);
    }

    return res.json({
      labels,
      values,
      title: "Daily focus (7 days) - minutes",
      range: `${startISO} to ${endISO}`
    });
  } catch (err) {
    console.error("❌ day dashboard error:", err);
    return res.status(500).json({ message: "Failed to load day dashboard" });
  }
});

// /api/dashboard/week - Last 4 weeks (avg minutes/day OR avg hours/day)
// Keeping it in hours/day but you can switch similarly.
router.get("/week", auth, async (req, res) => {
  try {
    const labels = ["Week 1", "Week 2", "Week 3", "Week 4"];
    const values = [null, null, null, null];

    const userObjectId = new mongoose.Types.ObjectId(req.userId);

    const stats = await DailyStat.aggregate([
      { $match: { userId: userObjectId } },
      { $addFields: { dateObj: { $dateFromString: { dateString: "$date" } } } },
      {
        $group: {
          _id: {
            y: { $isoWeekYear: "$dateObj" },
            w: { $isoWeek: "$dateObj" }
          },
          avgSecondsPerDay: { $avg: "$totalFocusSeconds" }
        }
      },
      { $sort: { "_id.y": 1, "_id.w": 1 } }
    ]);

    const last4 = stats.slice(-4);
    for (let i = 0; i < 4; i++) {
      const row = last4[i];
      if (!row) continue;

      // keep hours/day with 2 decimals
      const hrs = Number(((row.avgSecondsPerDay || 0) / 3600).toFixed(2));
      values[i] = hrs > 0 ? hrs : null;
    }

    return res.json({
      labels,
      values,
      title: "Weekly avg focus hours/day (last 4 weeks)",
      range: "Last 4 weeks"
    });
  } catch (err) {
    console.error("❌ week dashboard error:", err);
    return res.status(500).json({ message: "Failed to load week dashboard" });
  }
});

// /api/dashboard/month - 12 months for current year
router.get("/month", auth, async (req, res) => {
  try {
    const anchorRaw = req.query.date ? parseISODateOnly(req.query.date) : null;
    const anchor = anchorRaw || new Date();

    const year = new Date(anchor).getUTCFullYear();

    const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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
          avgSecondsPerDay: { $avg: "$totalFocusSeconds" }
        }
      },
      { $sort: { "_id.m": 1 } }
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
      title: `Monthly avg focus hours/day (${year})`,
      range: `Year ${year}`
    });
  } catch (err) {
    console.error("❌ month dashboard error:", err);
    return res.status(500).json({ message: "Failed to load month dashboard" });
  }
});

module.exports = router;
