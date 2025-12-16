const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    duration: {
      type: Number, // seconds
      required: true,
      min: 1,
    },
    type: {
      type: String,
      enum: ["focus", "break"],
      required: true,
      index: true,
    },
    completedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.model("Session", sessionSchema);
