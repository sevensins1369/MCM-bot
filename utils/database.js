// utils/database.js
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { logger } = require("./enhanced-logger");
require("dotenv").config();

// Global flag to track if we're using MongoDB or file-based storage
let usingMongoDB = false;

/**
 * Connect to MongoDB database
 * @returns {Promise<void>}
 */
async function connectToDatabase() {
  try {
    // Try different connection strings in order of preference
    const connectionStrings = [
      process.env.MONGODB_URI,
      "mongodb://127.0.0.1:27017/stakebot", // IPv4 explicit
      "mongodb://localhost:27017/stakebot", // hostname
    ];

    let lastError = null;

    // Try each connection string until one works
    for (const uri of connectionStrings) {
      if (!uri) continue; // Skip empty strings

      try {
        logger.info(
          "Database",
          `Attempting to connect to MongoDB with: ${uri.split("//")[1]}`
        );

        await mongoose.connect(uri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 5000, // 5 second timeout
          connectTimeoutMS: 10000, // 10 second timeout
          socketTimeoutMS: 45000, // 45 second timeout
          family: 4, // Force IPv4
        });

        logger.info("Database", "Connected to MongoDB successfully");
        usingMongoDB = true;

        // Set up connection event handlers
        setupMongooseEventHandlers();

        return; // Success, exit function
      } catch (error) {
        logger.warn("Database", `Connection attempt failed: ${error.message}`);
        lastError = error;
      }
    }

    // If we get here, all connection attempts failed
    logger.warn(
      "Database",
      "Failed to connect to MongoDB. Falling back to file-based storage."
    );
    ensureDataDirectory();
  } catch (error) {
    logger.error("Database", "Database initialization error", error);
    logger.warn("Database", "Falling back to file-based storage.");
    ensureDataDirectory();
  }
}

/**
 * Set up event handlers for mongoose connection
 */
function setupMongooseEventHandlers() {
  mongoose.connection.on("error", (error) => {
    logger.error("Database", "MongoDB connection error", error);
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("Database", "MongoDB disconnected. Attempting to reconnect...");
    usingMongoDB = false;

    // Try to reconnect after a delay
    setTimeout(() => {
      if (!usingMongoDB) {
        connectToDatabase().catch((err) => {
          logger.error("Database", "Failed to reconnect to MongoDB", err);
        });
      }
    }, 5000);
  });

  mongoose.connection.on("reconnected", () => {
    logger.info("Database", "Reconnected to MongoDB");
    usingMongoDB = true;
  });
}

/**
 * Helper function to ensure data directory exists and create empty data files
 */
function ensureDataDirectory() {
  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    logger.info("Database", "Created data directory");
  }

  // Create empty JSON files if they don't exist
  const dataFiles = [
    "wallets.json",
    "duels.json",
    "leaderboards.json",
    "data.json",
    "duelHistory.json",
    "playerStats.json",
    "userPreferences.json",
    "activeGames.json",
    "rollHistory.json",
    "diceTables.json",
    "flowergames.json",
    "jackpots.json",
    "hotcoldgames.json",
    "playerstats.json",
    "transactionlogs.json",
    "triggers.json",
    "userprofiles.json",
    "dicegames.json",
    "serverwallets.json",
  ];

  dataFiles.forEach((file) => {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "{}");
      logger.info("Database", `Created empty ${file} file`);
    }
  });
}

/**
 * Check if we're using MongoDB
 * @returns {boolean} True if using MongoDB, false if using file-based storage
 */
function isUsingMongoDB() {
  return usingMongoDB && mongoose.connection.readyState === 1;
}

/**
 * Get the current database status
 * @returns {Object} Database status information
 */
function getDatabaseStatus() {
  const status = {
    usingMongoDB,
    connectionState: mongoose.connection.readyState,
    connectionStateText: getConnectionStateText(mongoose.connection.readyState),
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
    models: Object.keys(mongoose.models),
    fallbackEnabled: true,
  };

  return status;
}

/**
 * Get a text representation of the connection state
 * @param {number} state - Mongoose connection state
 * @returns {string} Text representation of the state
 */
function getConnectionStateText(state) {
  switch (state) {
    case 0:
      return "disconnected";
    case 1:
      return "connected";
    case 2:
      return "connecting";
    case 3:
      return "disconnecting";
    case 99:
      return "uninitialized";
    default:
      return "unknown";
  }
}

module.exports = {
  connectToDatabase,
  isUsingMongoDB,
  ensureDataDirectory,
  getDatabaseStatus,
};

// Ensure the data directory exists
ensureDataDirectory();
