// backend/server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const passport = require("passport");
const path = require("path");

/* ===============================
   INIT APP
================================ */
const app = express();

/* ===============================
   DB & PASSPORT
================================ */
const connectDB = require("./config/db");
require("./config/passport");

/* ===============================
   ROUTES
================================ */
const authRoutes = require("./routes/authRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const adminRoutes = require("./routes/adminRoutes");
const userRoutes = require("./routes/userRoutes");
const presenceRoutes = require("./routes/presenceRoutes");

/* ===============================
   MIDDLEWARE
================================ */
app.use(cors());
app.use(express.json());

// Safer static path (absolute)
app.use(express.static(path.join(__dirname, "public"))); // [web:128]

app.use(passport.initialize()); // required for passport [web:130]

/* ===============================
   CONNECT DB
================================ */
connectDB();

/* ===============================
   DEBUG: confirm loaded files
================================ */
console.log("Server cwd:", process.cwd());
console.log("Loaded dashboardRoutes from:", require.resolve("./routes/dashboardRoutes"));
console.log("Loaded adminRoutes from:", require.resolve("./routes/adminRoutes"));
console.log("Loaded userRoutes from:", require.resolve("./routes/userRoutes"));
console.log("Loaded presenceRoutes from:", require.resolve("./routes/presenceRoutes"));

/* ===============================
   ROUTE MOUNTING
================================ */
app.use("/auth", authRoutes);
app.use("/api/session", sessionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/presence", presenceRoutes);

/* ===============================
   DEBUG: list registered routes
   Visit: http://localhost:5000/__routes
================================ */
app.get("/__routes", (req, res) => {
  const routes = [];

  // Express sometimes stores stack differently across versions; guard it. [web:120]
  const rootRouter = app._router || app.router;
  const stack = rootRouter?.stack || [];

  function walk(layers, prefix = "") {
    for (const layer of layers) {
      if (layer?.route?.path) {
        const methods = Object.keys(layer.route.methods || {})
          .filter((m) => layer.route.methods[m])
          .map((m) => m.toUpperCase());

        routes.push({
          methods,
          path: prefix + layer.route.path
        });
      } else if (layer?.name === "router" && layer?.handle?.stack) {
        walk(layer.handle.stack, prefix);
      }
    }
  }

  walk(stack, "");
  res.json({ routes });
});

/* ===============================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.json({ message: "Smart Pomodoro Backend Running" });
});

/* ===============================
   404 HANDLER
================================ */
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

/* ===============================
   ERROR HANDLER
================================ */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
