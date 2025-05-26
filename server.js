const express = require("express");
const app = express();
const cors = require("cors");
const router = require("./routes/index");
const router2 = require("./routes/second");
const dotenv = require("dotenv");
const connectDB = require("./utils/db");

dotenv.config();
const port = process.env.PORT || 5000;
const MODE = process.env.MODE || "local";

// Middleware
app.use(cors());
app.use(express.json());
app.use("/api", router);
app.use("/api2", router2);
app.get("/", (req, res) => {
  res.send("Hello to the Ascentia API");
});

// Store server instance
let server;

// Initialize cron jobs
const startCronJobs = () => {
  try {
    require('./CroneJob/cronJob');
    console.log('Cron jobs initialized successfully');
  } catch (error) {
    console.error('Failed to initialize cron jobs:', error);
  }
};

// Graceful shutdown function
const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error(
        "Could not close connections in time, forcefully shutting down"
      );
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

// Connect to database and start server
const startServer = async () => {
  try {
    await connectDB(MODE);
    server = app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
      
      // Start cron jobs after server is successfully started
      startCronJobs();
    });

    // Handle server shutdown
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("uncaughtException", (error) => {
      console.log("Uncaught Exception:", error);
      console.error("Uncaught Exception:", error);
      gracefulShutdown("uncaughtException");
    });
    process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2"));
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();