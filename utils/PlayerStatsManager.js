// utils/PlayerStatsManager.js
// Comprehensive player statistics manager with MongoDB optimization and timeframe support

const mongoose = require("mongoose");
const PlayerStats = require("../models/PlayerStats");
const { isUsingMongoDB } = require("./database");
const { logger } = require("../enhanced-logger");
const fs = require("fs");
const path = require("path");

// File path for storing stats when MongoDB is unavailable
const STATS_FILE_PATH = path.join(__dirname, "..", "data", "playerstats.json");

// In-memory cache for stats
let statsCache = new Map();
let duelHistoryCache = new Map();

// File paths for local storage
const STATS_FILE = path.join(__dirname, "../data/playerStats.json");
const DUEL_HISTORY_FILE = path.join(__dirname, "../data/duelHistory.json");

/**
 * Get player statistics with timeframe support
 * @param {string} userId - The user's Discord ID
 * @returns {Promise<Object>} Player statistics object with timeframe data
 */
async function getPlayerStats(userId) {
  try {
    let stats = null;

    if (isUsingMongoDB()) {
      // Try to get from MongoDB using new PlayerStats model
      stats = await PlayerStats.findOne({ userId });

      if (!stats) {
        // Create new stats document with timeframe structure
        stats = new PlayerStats({ userId });
        await stats.save();
        logger.debug("PlayerStatsManager", `Created new stats document for user ${userId}`);
      } else {
        // Check if timeframe resets are needed
        await checkAndResetTimeframes(stats);
      }
      
      // Convert to plain object and cache
      const statsObj = stats.toObject ? stats.toObject() : stats;
      statsCache.set(userId, statsObj);
      return statsObj;
    } else {
      // Use file-based storage with timeframe structure
      await loadStatsFromFile();
      stats = statsCache.get(userId);

      if (!stats) {
        stats = createTimeframeStats(userId);
        statsCache.set(userId, stats);
        await saveStatsToFile();
      } else {
        // Ensure timeframe structure exists (for backward compatibility)
        stats = ensureTimeframeStructure(stats);
        await checkAndResetTimeframes(stats);
      }
    }

    return stats;
  } catch (error) {
    logger.error("PlayerStatsManager", `Failed to get stats for user ${userId}`, error);
    // Return timeframe-based default stats as fallback
    return createTimeframeStats(userId);
  }
}

// Get stats from file
function getStatsFromFile(userId) {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const data = fs.readFileSync(STATS_FILE, "utf8");
      const stats = JSON.parse(data);

      if (stats[userId]) {
        // Add donation fields if they don't exist
        if (!stats[userId].osrsDonated) stats[userId].osrsDonated = "0";
        if (!stats[userId].rs3Donated) stats[userId].rs3Donated = "0";

        statsCache.set(userId, stats[userId]);
        return stats[userId];
      }
    }

    // If not found, create default stats
    return createDefaultStats(userId);
  } catch (error) {
    console.error(`Error reading stats from file for user ${userId}:`, error);
    return createDefaultStats(userId);
  }
}

// Create default stats
function createDefaultStats(userId) {
  const defaultStats = {
    userId,
    gamesPlayed: 0,
    gamesWon: 0,
    gamesLost: 0,
    betsPlaced: 0,
    betsWon: 0,
    betsLost: 0,
    duelsWon: 0,
    duelsLost: 0,
    duelsHosted: 0,
    osrsWagered: "0",
    osrsWon: "0",
    osrsLost: "0",
    rs3Wagered: "0",
    rs3Won: "0",
    rs3Lost: "0",
    osrsDonated: "0", // Add donation fields
    rs3Donated: "0", // Add donation fields
    lastPlayed: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  statsCache.set(userId, defaultStats);
  saveStats();
  return defaultStats;
}

// Update player stats
async function updatePlayerStats(userId, updates) {
  try {
    // Get current stats
    const stats = await getPlayerStats(userId);

    // Apply updates
    Object.entries(updates).forEach(([key, value]) => {
      // *** THIS IS THE FIX ***
      // Only treat keys starting with 'osrs' or 'rs3' as BigInt currency strings
      if (key.startsWith("osrs") || key.startsWith("rs3")) {
        const currentValue = BigInt(stats[key] || "0");
        const updateValue = BigInt(value || "0");
        stats[key] = (currentValue + updateValue).toString();
      } else if (typeof value === "number") {
        // Handle all other numeric stats like duelsWon, gamesPlayed, etc.
        stats[key] = (stats[key] || 0) + value;
      } else {
        // For other values (like timestamps), just replace
        stats[key] = value;
      }
    });

    // Update timestamp
    stats.updatedAt = new Date();
    stats.lastPlayed = new Date();

    // Update cache
    statsCache.set(userId, stats);

    // Save to storage
    if (isUsingMongoDB()) {
      try {
        const PlayerStats = require("../models/PlayerStats");
        if (PlayerStats) {
          await PlayerStats.updateOne({ userId }, stats, { upsert: true });
        }
      } catch (error) {
        console.error(
          `Error updating stats in MongoDB for user ${userId}:`,
          error
        );
      }
    } else {
      saveStats();
    }

    return stats;
  } catch (error) {
    console.error(`Error updating stats for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Update a user's donation stats
 * @param {string} userId - The user's Discord ID
 * @param {string} currency - The currency (osrs or rs3)
 * @param {BigInt|string} amount - The donation amount
 * @returns {Promise<Object>} Updated player stats
 */
async function updateDonationStats(userId, currency, amount) {
  try {
    // Validate inputs
    if (!userId || !currency || !amount) {
      console.warn(
        "PlayerStatsManager",
        "Missing required parameters for updateDonationStats"
      );
      return null;
    }

    // Convert amount to string if it's a BigInt
    const amountStr = typeof amount === "bigint" ? amount.toString() : amount;

    // Create updates object
    const updates = {};

    // Add donation to the appropriate currency field
    // We'll create new fields for donations if they don't exist
    const donationField = `${currency}Donated`;
    updates[donationField] = amountStr;

    // Update the player's stats
    const updatedStats = await updatePlayerStats(userId, updates);

    console.log(
      `Updated donation stats for user ${userId}: ${amountStr} ${currency}`
    );
    return updatedStats;
  } catch (error) {
    console.error(`Error updating donation stats for user ${userId}:`, error);
    return null;
  }
}

// Add a duel to a player's history
async function addDuelToHistory(userId, duelData) {
  try {
    let history = duelHistoryCache.get(userId) || [];

    history.unshift({
      type: duelData.type,
      result: duelData.result,
      opponent: duelData.opponent,
      timestamp: duelData.timestamp || new Date(),
    });

    if (history.length > 50) {
      history = history.slice(0, 50);
    }

    duelHistoryCache.set(userId, history);

    if (isUsingMongoDB()) {
      try {
        const PlayerStats = require("../models/PlayerStats");
        if (PlayerStats) {
          await PlayerStats.updateOne(
            { userId },
            { $set: { duelHistory: history } },
            { upsert: true }
          );
        }
      } catch (error) {
        console.error(
          `Error updating duel history in MongoDB for user ${userId}:`,
          error
        );
      }
    } else {
      saveDuelHistory();
    }

    return true;
  } catch (error) {
    console.error(`Error adding duel to history for user ${userId}:`, error);
    return false;
  }
}

// Get a player's duel history
async function getDuelHistory(userId, limit = 15) {
  try {
    if (duelHistoryCache.has(userId)) {
      return duelHistoryCache.get(userId).slice(0, limit);
    }

    if (isUsingMongoDB()) {
      try {
        const PlayerStats = require("../models/PlayerStats");
        if (PlayerStats) {
          const stats = await PlayerStats.findOne({ userId }).select(
            "duelHistory"
          );
          const history = stats ? stats.duelHistory : [];
          duelHistoryCache.set(userId, history);
          return history.slice(0, limit);
        }
      } catch (error) {
        console.error(
          `Error getting duel history from MongoDB for user ${userId}:`,
          error
        );
      }
    }

    return getDuelHistoryFromFile(userId).slice(0, limit);
  } catch (error) {
    console.error(`Error getting duel history for user ${userId}:`, error);
    return [];
  }
}

// Get duel history from file
function getDuelHistoryFromFile(userId) {
  try {
    if (fs.existsSync(DUEL_HISTORY_FILE)) {
      const data = fs.readFileSync(DUEL_HISTORY_FILE, "utf8");
      const history = JSON.parse(data);

      if (history[userId]) {
        duelHistoryCache.set(userId, history[userId]);
        return history[userId];
      }
    }
    return [];
  } catch (error) {
    console.error(
      `Error reading duel history from file for user ${userId}:`,
      error
    );
    return [];
  }
}

// Save all duel history to file
function saveDuelHistory() {
  try {
    const history = {};
    duelHistoryCache.forEach((userHistory, userId) => {
      history[userId] = userHistory;
    });

    fs.writeFileSync(DUEL_HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error("Error saving duel history to file:", error);
  }
}

// Load all duel history from file
function loadDuelHistory() {
  try {
    if (fs.existsSync(DUEL_HISTORY_FILE)) {
      const data = fs.readFileSync(DUEL_HISTORY_FILE, "utf8");
      const history = JSON.parse(data);

      Object.entries(history).forEach(([userId, userHistory]) => {
        duelHistoryCache.set(userId, userHistory);
      });

      console.log(
        `Loaded duel history for ${duelHistoryCache.size} players from file`
      );
    } else {
      console.log(
        "No duel history file found. Starting with empty history cache."
      );
      saveDuelHistory();
    }
  } catch (error) {
    console.error("Error loading duel history from file:", error);
    saveDuelHistory();
  }
}

// Save all stats to file
function saveStats() {
  try {
    const stats = {};
    statsCache.forEach((userStats, userId) => {
      stats[userId] = userStats;
    });

    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error("Error saving stats to file:", error);
  }
}

// Load all stats from file
function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const data = fs.readFileSync(STATS_FILE, "utf8");
      const stats = JSON.parse(data);

      Object.entries(stats).forEach(([userId, userStats]) => {
        // Add donation fields if they don't exist
        if (!userStats.osrsDonated) userStats.osrsDonated = "0";
        if (!userStats.rs3Donated) userStats.rs3Donated = "0";

        statsCache.set(userId, userStats);
      });

      console.log(`Loaded ${statsCache.size} player stats from file`);
    } else {
      console.log(
        "No player stats file found. Starting with empty stats cache."
      );
      saveStats();
    }
  } catch (error) {
    console.error("Error loading stats from file:", error);
    saveStats();
  }
}

/**
 * Get leaderboard statistics
 * @param {string} timeframe - The timeframe to filter by (daily, weekly, monthly, allTime)
 * @param {string} sortField - The field to sort by
 * @param {number} sortDirection - The sort direction (1 for ascending, -1 for descending)
 * @param {number} skip - Number of records to skip (for pagination)
 * @param {number} limit - Maximum number of records to return
 * @returns {Object} Object containing stats array and total count
 */
async function getLeaderboardStats(
  timeframe,
  sortField,
  sortDirection,
  skip,
  limit
) {
  try {
    if (isUsingMongoDB()) {
      const PlayerStats = require("../models/PlayerStats");
      if (!PlayerStats) {
        return { stats: [], totalCount: 0 };
      }

      // Get host role ID from environment
      const HOST_ROLE_ID = process.env.HOST_ROLE_ID;

      // Create query to exclude hosts if HOST_ROLE_ID is defined
      let query = {};

      // Get total count (excluding the pagination)
      const totalCount = await PlayerStats.countDocuments(query);

      // Get the stats with pagination
      const stats = await PlayerStats.find(query)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean();

      return { stats, totalCount };
    } else {
      // File-based implementation
      const allStats = [];

      // Convert cache to array for sorting
      statsCache.forEach((stats, userId) => {
        // Add the stats to the array
        allStats.push(stats);
      });

      // Sort the array based on the specified field and direction
      const sortedStats = allStats.sort((a, b) => {
        // Extract the field value based on timeframe and field name
        const fieldA = getNestedValue(a, sortField) || "0";
        const fieldB = getNestedValue(b, sortField) || "0";

        // Compare based on field type
        if (
          sortField.includes("Profit") ||
          sortField.includes("Wagered") ||
          sortField.includes("Won") ||
          sortField.includes("Lost") ||
          sortField.includes("Donated")
        ) {
          // BigInt comparison for currency values
          return sortDirection * (BigInt(fieldA) - BigInt(fieldB));
        } else {
          // Regular number comparison
          return sortDirection * (Number(fieldA) - Number(fieldB));
        }
      });

      const totalCount = sortedStats.length;
      const paginatedStats = sortedStats.slice(skip, skip + limit);

      return { stats: paginatedStats, totalCount };
    }
  } catch (error) {
    console.error("Error getting leaderboard stats:", error);
    return { stats: [], totalCount: 0 };
  }
}

// Helper function to get nested value from an object
function getNestedValue(obj, path) {
  const parts = path.split(".");
  let current = obj;

  for (const part of parts) {
    if (current == null) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

// Initialize stats
function initStats() {
  if (!isUsingMongoDB()) {
    loadStats();
    loadDuelHistory();
  }
}

// Call initStats on module load
initStats();

// Add this function to your PlayerStatsManager.js file
function debugStats(userId) {
  console.log("DEBUG STATS FOR USER:", userId);

  // Check cache
  if (statsCache.has(userId)) {
    console.log("STATS IN CACHE:", statsCache.get(userId));
  } else {
    console.log("NO STATS IN CACHE FOR USER");
  }

  // Check file
  const STATS_FILE = path.join(__dirname, "../data/playerStats.json");
  if (fs.existsSync(STATS_FILE)) {
    try {
      const data = fs.readFileSync(STATS_FILE, "utf8");
      const stats = JSON.parse(data);

      if (stats[userId]) {
        console.log("STATS IN FILE:", stats[userId]);
      } else {
        console.log("NO STATS IN FILE FOR USER");
      }
    } catch (error) {
      console.error("ERROR READING STATS FILE:", error);
    }
  } else {
    console.log("STATS FILE DOES NOT EXIST");
  }
}

/**
 * Get donation leaderboard
 * @param {string} currency - The currency to get leaderboard for ('osrs' or 'rs3')
 * @param {number} limit - The maximum number of results to return
 * @returns {Array} The donation leaderboard data
 */
async function getDonationLeaderboard(currency, limit = 10) {
  try {
    const sortField = `${currency}Donated`;

    if (isUsingMongoDB()) {
      const PlayerStats = require("../models/PlayerStats");
      if (!PlayerStats) {
        return [];
      }

      // Create query to filter out zero donations
      const query = {};
      query[sortField] = { $gt: "0" };

      const leaderboard = await PlayerStats.find(query)
        .sort({ [sortField]: -1 })
        .limit(limit)
        .lean();

      return leaderboard;
    } else {
      // File-based implementation
      const allStats = [];

      // Convert cache to array for sorting
      statsCache.forEach((stats, userId) => {
        // Only include users with donations
        if (stats[sortField] && stats[sortField] !== "0") {
          allStats.push(stats);
        }
      });

      // Sort by donation amount (descending)
      const sortedStats = allStats.sort((a, b) => {
        const donationA = BigInt(a[sortField] || "0");
        const donationB = BigInt(b[sortField] || "0");
        return Number(donationB - donationA); // Convert BigInt difference to Number for sorting
      });

      return sortedStats.slice(0, limit);
    }
  } catch (error) {
    console.error(`Error getting ${currency} donation leaderboard:`, error);
    return [];
  }
}

/**
 * Create timeframe-based statistics structure
 * @param {string} userId - User's Discord ID
 * @returns {Object} Timeframe-based statistics object
 */
function createTimeframeStats(userId) {
  const defaultTimeframe = {
    duelsWon: 0,
    duelsLost: 0,
    duelsHosted: 0,
    osrsProfit: "0",
    rs3Profit: "0",
    osrsWagered: "0",
    rs3Wagered: "0",
    osrsDonated: "0",
    rs3Donated: "0",
    diceWon: 0,
    diceLost: 0,
    diceOsrsProfit: "0",
    diceRs3Profit: "0",
    diceOsrsWagered: "0",
    diceRs3Wagered: "0",
    diceDuelsWon: 0,
    diceDuelsLost: 0,
    diceDuelsOsrsProfit: "0",
    diceDuelsRs3Profit: "0",
    diceDuelsOsrsWagered: "0",
    diceDuelsRs3Wagered: "0",
    flowersWon: 0,
    flowersLost: 0,
    flowersOsrsProfit: "0",
    flowersRs3Profit: "0",
    flowersOsrsWagered: "0",
    flowersRs3Wagered: "0",
    hotColdWon: 0,
    hotColdLost: 0,
    hotColdOsrsProfit: "0",
    hotColdRs3Profit: "0",
    hotColdOsrsWagered: "0",
    hotColdRs3Wagered: "0",
  };

  return {
    userId,
    allTime: { ...defaultTimeframe },
    daily: { ...defaultTimeframe },
    weekly: { ...defaultTimeframe },
    monthly: { ...defaultTimeframe },
    currentDuelStreak: 0,
    bestDuelStreak: 0,
    currentDiceStreak: 0,
    bestDiceStreak: 0,
    currentDiceDuelStreak: 0,
    bestDiceDuelStreak: 0,
    currentFlowerStreak: 0,
    bestFlowerStreak: 0,
    currentHotColdStreak: 0,
    bestHotColdStreak: 0,
    dailyResetAt: getNextDayStart(),
    weeklyResetAt: getNextWeekStart(),
    monthlyResetAt: getNextMonthStart(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Ensure old stats have timeframe structure (backward compatibility)
 * @param {Object} stats - Existing stats object
 * @returns {Object} Stats object with timeframe structure
 */
function ensureTimeframeStructure(stats) {
  if (!stats.allTime) {
    // Convert old format to new timeframe structure
    const oldStats = { ...stats };
    const newStats = createTimeframeStats(stats.userId);
    
    // Migrate old data to allTime timeframe
    if (oldStats.duelsWon) newStats.allTime.duelsWon = oldStats.duelsWon;
    if (oldStats.duelsLost) newStats.allTime.duelsLost = oldStats.duelsLost;
    if (oldStats.osrsWagered) newStats.allTime.osrsWagered = oldStats.osrsWagered;
    if (oldStats.rs3Wagered) newStats.allTime.rs3Wagered = oldStats.rs3Wagered;
    if (oldStats.osrsDonated) newStats.allTime.osrsDonated = oldStats.osrsDonated;
    if (oldStats.rs3Donated) newStats.allTime.rs3Donated = oldStats.rs3Donated;
    
    // Preserve streak data and timestamps
    newStats.currentDuelStreak = oldStats.currentDuelStreak || 0;
    newStats.bestDuelStreak = oldStats.bestDuelStreak || 0;
    newStats.createdAt = oldStats.createdAt || new Date();
    newStats.updatedAt = oldStats.updatedAt || new Date();
    
    return newStats;
  }
  
  return stats;
}

/**
 * Check and reset timeframe statistics if needed
 * @param {Object} stats - Player statistics object
 */
async function checkAndResetTimeframes(stats) {
  const now = new Date();
  let needsUpdate = false;

  // Check daily reset
  if (stats.dailyResetAt && now >= new Date(stats.dailyResetAt)) {
    stats.daily = createTimeframeStats(stats.userId).allTime; // Reset to default timeframe
    stats.dailyResetAt = getNextDayStart();
    needsUpdate = true;
  }

  // Check weekly reset
  if (stats.weeklyResetAt && now >= new Date(stats.weeklyResetAt)) {
    stats.weekly = createTimeframeStats(stats.userId).allTime; // Reset to default timeframe
    stats.weeklyResetAt = getNextWeekStart();
    needsUpdate = true;
  }

  // Check monthly reset
  if (stats.monthlyResetAt && now >= new Date(stats.monthlyResetAt)) {
    stats.monthly = createTimeframeStats(stats.userId).allTime; // Reset to default timeframe
    stats.monthlyResetAt = getNextMonthStart();
    needsUpdate = true;
  }

  if (needsUpdate) {
    if (isUsingMongoDB() && stats.save) {
      try {
        await stats.save();
      } catch (error) {
        logger.error("PlayerStatsManager", "Failed to save timeframe resets", error);
      }
    } else {
      await saveStatsToFile();
    }
  }
}

/**
 * Load statistics from file storage
 * @returns {Promise<void>}
 */
async function loadStatsFromFile() {
  try {
    if (fs.existsSync(STATS_FILE_PATH)) {
      const data = await fs.promises.readFile(STATS_FILE_PATH, "utf8");
      const statsData = JSON.parse(data);
      statsCache.clear();
      
      for (const [userId, stats] of Object.entries(statsData)) {
        // Ensure timeframe structure exists
        const processedStats = ensureTimeframeStructure(stats);
        statsCache.set(userId, processedStats);
      }
      
      logger.info("PlayerStatsManager", `Loaded ${statsCache.size} player stats from file`);
    }
  } catch (error) {
    logger.error("PlayerStatsManager", "Failed to load stats from file", error);
    statsCache = new Map();
  }
}

/**
 * Save statistics to file storage
 * @returns {Promise<void>}
 */
async function saveStatsToFile() {
  try {
    const statsObject = {};
    for (const [userId, stats] of statsCache.entries()) {
      statsObject[userId] = stats;
    }
    
    await fs.promises.writeFile(STATS_FILE_PATH, JSON.stringify(statsObject, null, 2));
    logger.debug("PlayerStatsManager", "Saved player stats to file");
  } catch (error) {
    logger.error("PlayerStatsManager", "Failed to save stats to file", error);
  }
}

// Helper functions for timestamp calculation
function getNextDayStart() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

function getNextWeekStart() {
  const nextWeek = new Date();
  const daysUntilMonday = (7 - nextWeek.getDay() + 1) % 7 || 7;
  nextWeek.setDate(nextWeek.getDate() + daysUntilMonday);
  nextWeek.setHours(0, 0, 0, 0);
  return nextWeek;
}

function getNextMonthStart() {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
  nextMonth.setHours(0, 0, 0, 0);
  return nextMonth;
}

module.exports = {
  getPlayerStats,
  updatePlayerStats,
  addDuelToHistory,
  getDuelHistory,
  loadStats,
  saveStats,
  debugStats,
  getLeaderboardStats,
  updateDonationStats,
  getDonationLeaderboard,
  createTimeframeStats,
  ensureTimeframeStructure,
  checkAndResetTimeframes,
  loadStatsFromFile,
  saveStatsToFile,
  statsCache
};
