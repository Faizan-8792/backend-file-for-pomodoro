require("dotenv").config();

const express = require("express");
const cors = require("cors");
const passport = require("passport");
const path = require("path");

/* ===============================
   INIT APP
=============================== */
const app = express();

/* ===============================
   DB & PASSPORT
=============================== */
const connectDB = require("./config/db");
require("./config/passport");

/* ===============================
   ROUTES
=============================== */
const authRoutes = require("./routes/authRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const adminRoutes = require("./routes/adminRoutes");
const userRoutes = require("./routes/userRoutes");

/* ===============================
   MIDDLEWARE
=============================== */
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.use(passport.initialize());

/* ===============================
   CONNECT DB
=============================== */
connectDB();

/* ===============================
   DEBUG: confirm loaded files
=============================== */
console.log("Server cwd:", process.cwd());
console.log("Loaded dashboardRoutes from:", require.resolve("./routes/dashboardRoutes"));
console.log("Loaded adminRoutes from:", require.resolve("./routes/adminRoutes"));
console.log("Loaded userRoutes from:", require.resolve("./routes/userRoutes"));

/* ===============================
   ROUTE MOUNTING
=============================== */
app.use("/auth", authRoutes);
app.use("/api/session", sessionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);

/* ===============================
   DEBUG: list registered routes
   Visit: http://localhost:5000/__routes
=============================== */
app.get("/__routes", (req, res) => {
  const routes = [];

  function walk(stack, prefix = "") {
    for (const layer of stack) {
      if (layer.route && layer.route.path) {
        const methods = Object.keys(layer.route.methods || {})
          .filter((m) => layer.route.methods[m])
          .map((m) => m.toUpperCase());

        routes.push({
          methods,
          path: prefix + layer.route.path,
        });
      } else if (layer.name === "router" && layer.handle && layer.handle.stack) {
        // Attempt to reconstruct mount path from layer.regexp (best-effort)
        walk(layer.handle.stack, prefix);
      }
    }
  }

  walk(app._router.stack, "");
  res.json({ routes });
});

/* ===============================
   HEALTH CHECK
=============================== */
app.get("/", (req, res) => {
  res.json({ message: "Smart Pomodoro Backend Running" });
});

/* ===============================
   404 HANDLER
=============================== */
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

/* ===============================
   ERROR HANDLER
=============================== */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

/* ===============================
   START SERVER
=============================== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
