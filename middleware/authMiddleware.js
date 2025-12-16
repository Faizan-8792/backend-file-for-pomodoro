const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const token = authHeader.split(" ")[1];

    // Keep same env var name used throughout backend: JWT_SECRET. [file:40]
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Keep same request property used by controllers: req.userId. [file:59]
    req.userId = decoded.id;

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};
