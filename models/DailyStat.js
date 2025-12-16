const mongoose = require("mongoose");

const dailyStatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },
    totalFocusSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    versionKey: false,
  }
);

// Ensure one stat doc per user per date (keeps logic consistent, prevents duplicates). [file:62]
dailyStatSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("DailyStat", dailyStatSchema);
