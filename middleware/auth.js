const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.log(error);
    return res.status(401).json({ message: "Invalid token" });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

const isTutor = (req, res, next) => {
  if (req.user?.role !== "tutor") {
    return res.status(403).json({ message: "Tutor access required" });
  }
  next();
};

const isStudent = (req, res, next) => {
  if (req.user?.role !== "student") {
    return res.status(403).json({ message: "Student access required" });
  }
  next();
};

module.exports = { authenticateJWT, isAdmin, isTutor, isStudent };
