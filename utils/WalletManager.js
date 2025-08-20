// utils/WalletManager.js
// Manages user wallets for the bot

const fs = require("fs");
const path = require("path");
const { isUsingMongoDB } = require("./database");
const { logger } = require("../enhanced-logger");
const mongoose = require("mongoose");

// File path for storing wallets when MongoDB is unavailable
const WALLETS_FILE_PATH = path.join(__dirname, "..", "data", "wallets.json");

// In-memory cache for wallets
let wallets = new Map();

/**
 * Load wallets from database or file with improved error handling
 * @returns {Promise<void>}
 */
async function loadWallets() {
  try {
    if (isUsingMongoDB()) {
      // Try to load from MongoDB with timeout and retry logic
      const Wallet = require("../models/Wallet");
      if (!Wallet) {
        logger.warn("WalletManager", "Wallet model not available, using file storage");
        await loadWalletsFromFile();
        return;
      }

      // Use lean() for better performance and add timeout
      const walletDocs = await Wallet.find({}).lean().maxTimeMS(10000);

      walletDocs.forEach((wallet) => {
        // Ensure BigInt conversion for amounts
        const walletObj = {
          ...wallet,
          osrs: BigInt(wallet.osrs || "0"),
          rs3: BigInt(wallet.rs3 || "0")
        };
        wallets.set(wallet.userId, walletObj);
      });

      logger.info(
        "WalletManager",
        `Loaded ${wallets.size} wallets from MongoDB database`
      );
    } else {
      // Load from file
      await loadWalletsFromFile();
    }
  } catch (error) {
    logger.error(
      "WalletManager",
      "Failed to load wallets from database",
      error
    );
    // Always try file as fallback
    try {
      await loadWalletsFromFile();
      logger.info("WalletManager", "Successfully fell back to file storage");
    } catch (fileError) {
      logger.error("WalletManager", "Failed to load from file as well", fileError);
      // Initialize empty cache as last resort
      wallets = new Map();
    }
  }
}

/**
 * Load wallets from file
 * @returns {Promise<void>}
 */
async function loadWalletsFromFile() {
  try {
    // Check if file exists
    try {
      await fs.promises.access(WALLETS_FILE_PATH);
    } catch (error) {
      // Create empty file if it doesn't exist
      await fs.promises.writeFile(WALLETS_FILE_PATH, JSON.stringify({}));
      logger.info(
        "WalletManager",
        `Created empty wallets file at ${WALLETS_FILE_PATH}`
      );
      return;
    }

    // Read file
    const data = await fs.promises.readFile(WALLETS_FILE_PATH, "utf8");
    const walletsData = JSON.parse(data);

    // Convert string amounts to BigInt
    for (const [userId, wallet] of Object.entries(walletsData)) {
      if (wallet.osrs) wallet.osrs = BigInt(wallet.osrs);
      if (wallet.rs3) wallet.rs3 = BigInt(wallet.rs3);
      wallets.set(userId, wallet);
    }

    logger.info("WalletManager", `Loaded ${wallets.size} wallets from file`);
  } catch (error) {
    logger.error("WalletManager", "Failed to load wallets from file", error);
    // Initialize with empty map
    wallets = new Map();
  }
}

/**
 * Save wallets to database or file
 * @returns {Promise<void>}
 */
async function saveWallets() {
  try {
    if (isUsingMongoDB()) {
      // Save to MongoDB
      const Wallet = require("../models/Wallet");

      for (const [userId, wallet] of wallets.entries()) {
        await Wallet.findOneAndUpdate(
          { userId },
          {
            ...wallet,
            // Convert BigInt to string for MongoDB
            osrs: wallet.osrs.toString(),
            rs3: wallet.rs3.toString(),
          },
          { upsert: true, new: true }
        );
      }

      logger.debug("WalletManager", "Saved wallets to database");
    } else {
      // Save to file
      const walletsToSave = {};

      for (const [userId, wallet] of wallets.entries()) {
        walletsToSave[userId] = {
          ...wallet,
          // Convert BigInt to string for JSON serialization
          osrs: wallet.osrs.toString(),
          rs3: wallet.rs3.toString(),
        };
      }

      await fs.promises.writeFile(
        WALLETS_FILE_PATH,
        JSON.stringify(walletsToSave, null, 2)
      );
      logger.debug("WalletManager", "Saved wallets to file");
    }
  } catch (error) {
    logger.error("WalletManager", "Failed to save wallets", error);
  }
}

/**
 * Get a user's wallet
 * @param {string} userId - The user's Discord ID
 * @returns {Object} The user's wallet
 */
async function getWallet(userId) {
  // Check if wallet exists in memory
  if (wallets.has(userId)) {
    return wallets.get(userId);
  }

  // Try to get from database
  if (isUsingMongoDB()) {
    try {
      const Wallet = require("../models/Wallet");
      const wallet = await Wallet.findOne({ userId });

      if (wallet) {
        // Convert string amounts to BigInt
        const walletObj = wallet.toObject ? wallet.toObject() : wallet;
        walletObj.osrs = BigInt(walletObj.osrs);
        walletObj.rs3 = BigInt(walletObj.rs3);

        // Cache in memory
        wallets.set(userId, walletObj);
        return walletObj;
      }
    } catch (error) {
      logger.error(
        "WalletManager",
        `Failed to get wallet for user ${userId} from database`,
        error
      );
    }
  }

  // Create new wallet if not found
  return createNewWallet(userId);
}

/**
 * Create a new wallet for a user
 * @param {string} userId - The user's Discord ID
 * @returns {Object} The new wallet
 */
function createNewWallet(userId) {
  const wallet = {
    userId,
    osrs: BigInt(0),
    rs3: BigInt(0),
    isPrivate: false,
    isLocked: false,
    lockExpiresAt: null,
    updatedAt: new Date(),
  };

  // Cache in memory
  wallets.set(userId, wallet);

  // Save to database/file
  saveWallets();

  return wallet;
}

/**
 * Update a user's wallet
 * @param {string} userId - The user's Discord ID
 * @param {Object} updates - The updates to apply
 * @returns {Object} The updated wallet
 */
async function updateWallet(userId, updates) {
  // Get current wallet
  const wallet = await getWallet(userId);

  // Check if wallet is locked
  if (wallet.isLocked) {
    const now = new Date();
    const lockExpires = new Date(wallet.lockExpiresAt);

    if (now < lockExpires) {
      throw new Error(
        `This wallet is locked until ${lockExpires.toLocaleString()}`
      );
    } else {
      // Unlock wallet if lock has expired
      wallet.isLocked = false;
      wallet.lockExpiresAt = null;
    }
  }

  // Apply updates
  Object.keys(updates).forEach((key) => {
    if (key === "osrs" || key === "rs3") {
      // Ensure currency values are BigInt
      wallet[key] = BigInt(updates[key]);
    } else {
      wallet[key] = updates[key];
    }
  });

  // Update timestamp
  wallet.updatedAt = new Date();

  // Save to database/file
  await saveWallets();

  // Log transaction
  try {
    await logTransaction(userId, updates);
  } catch (error) {
    logger.error("WalletManager", "Error logging transaction", { error });
  }

  return wallet;
}

/**
 * Log a wallet transaction
 * @param {string} userId - The user's Discord ID
 * @param {Object} updates - The updates applied
 * @returns {Promise<void>}
 */
async function logTransaction(userId, updates) {
  try {
    const logEntry = {
      userId,
      timestamp: new Date(),
      details: {},
    };

    // Add relevant details
    Object.keys(updates).forEach((key) => {
      if (key === "osrs" || key === "rs3") {
        logEntry.details[key] = updates[key];
      }
    });

    // Convert BigInt values to strings for JSON serialization
    Object.keys(logEntry.details).forEach((key) => {
      if (typeof logEntry.details[key] === "bigint") {
        logEntry.details[key] = logEntry.details[key].toString();
      }
    });

    // Save to transaction log
    if (isUsingMongoDB()) {
      try {
        // Check if the model already exists before defining it
        let TransactionLog;
        if (mongoose.models.TransactionLog) {
          TransactionLog = mongoose.models.TransactionLog;
        } else {
          TransactionLog = mongoose.model(
            "TransactionLog",
            new mongoose.Schema({
              userId: String,
              timestamp: Date,
              details: Object,
            })
          );
        }

        await TransactionLog.create(logEntry);
      } catch (error) {
        logger.error(
          "WalletManager",
          "Failed to log transaction to database",
          error
        );
      }
    } else {
      // Append to log file
      const logFilePath = path.join(
        __dirname,
        "..",
        "data",
        "transaction_log.json"
      );

      try {
        let logs = [];

        // Read existing logs if file exists
        try {
          const data = await fs.promises.readFile(logFilePath, "utf8");
          logs = JSON.parse(data);
        } catch (error) {
          // Ignore if file doesn't exist
        }

        // Add new log entry
        logs.push(logEntry);

        // Write back to file
        await fs.promises.writeFile(logFilePath, JSON.stringify(logs, null, 2));
      } catch (error) {
        logger.error(
          "WalletManager",
          "Failed to log transaction to file",
          error
        );
      }
    }
  } catch (error) {
    logger.error("WalletManager", "Error in logTransaction", error);
  }
}

module.exports = {
  loadWallets,
  saveWallets,
  getWallet,
  updateWallet,
};
