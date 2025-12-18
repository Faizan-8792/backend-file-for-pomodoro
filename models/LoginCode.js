const mongoose = require("mongoose");

const loginCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, default: null }
  },
  { versionKey: false }
);

// TTL cleanup (Mongo will delete after expiresAt)
loginCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("LoginCode", loginCodeSchema);
