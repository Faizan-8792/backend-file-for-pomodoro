const mongoose = require("mongoose");

const BrowseStatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Store domain only (example: "youtube.com")
    domain: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    // Aggregates
    count: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastVisitedAt: {
      type: Date,
      default: null,
    },

    firstSeenAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// One stat doc per (userId, domain)
BrowseStatSchema.index({ userId: 1, domain: 1 }, { unique: true });

module.exports = mongoose.model("BrowseStat", BrowseStatSchema);
