/**
 * NOTE:
 * This file existed alongside authMiddleware.js.
 * To keep your project stable and integrated, this file is now a thin wrapper
 * around the single source of truth: authMiddleware.js. [file:38][file:40]
 *
 * This avoids duplicate JWT parsing logic while keeping old import paths working.
 */

module.exports = require("./authMiddleware");
