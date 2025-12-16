const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Keep same env var name and connection behavior. [file:42]
    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error?.message || error);
    process.exit(1);
  }
};

module.exports = connectDB;
