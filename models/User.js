const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, index: true, unique: true },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    photo: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.model("User", userSchema);
