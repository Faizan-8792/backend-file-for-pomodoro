const express = require("express");

const router = express.Router();

// Keep using the same middleware file path currently wired. [file:39]
const auth = require("../middleware/authMiddleware");

// Keep controller contract the same: { saveSession } export. [file:39]
const { saveSession } = require("../controllers/sessionController");

// POST /api/session
router.post("/", auth, saveSession);

module.exports = router;
