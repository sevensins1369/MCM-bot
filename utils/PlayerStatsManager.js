// utils/PlayerStatsManager.js
const mongoose = require("mongoose");
const { isUsingMongoDB } = require("./database");
const fs = require("fs");
const path = require("path");

// In-memory cache
const statsCache = new Map();
const duelHistoryCache = new Map();

// File paths for local storage
const STATS_FILE = path.join(__dirname, "../data/playerStats.json");
const DUEL_HISTORY_FILE = path.join(__dirname, "../data/duelHistory.json");

// Get player stats
async function getPlayerStats(userId) {
  // Check cache first
  if (statsCache.has(userId)) {
    return statsCache.get(userId);
  }

  try {
    if (isUsingMongoDB()) {
      // Try to get from MongoDB
      const PlayerStats = require("../models/PlayerStats");
      if (!PlayerStats) {
        return createDefaultStats(userId);
      }

      const stats = await PlayerStats.findOne({ userId });
      if (stats) {
        const statsData = {
          userId: stats.userId,
          gamesPlayed: stats.gamesPlayed,
          gamesWon: stats.gamesWon,
          gamesLost: stats.gamesLost,
          betsPlaced: stats.betsPlaced,
          betsWon: stats.betsWon,
          betsLost: stats.betsLost,
          duelsWon: stats.duelsWon || 0,
          duelsLost: stats.duelsLost || 0,
          duelsHosted: stats.duelsHosted || 0,
          osrsWagered: stats.osrsWagered,
          osrsWon: stats.osrsWon,
          osrsLost: stats.osrsLost,
          rs3Wagered: stats.rs3Wagered,
          rs3Won: stats.rs3Won,
          rs3Lost: stats.rs3Lost,
          lastPlayed: stats.lastPlayed,
          createdAt: stats.createdAt,
          updatedAt: stats.updatedAt,
        };
        statsCache.set(userId, statsData);
        return statsData;
      }
    } else {
      // Try to get from file
      return getStatsFromFile(userId);
    }

    // If not found, create default stats
    return createDefaultStats(userId);
  } catch (error) {
    console.error(`Error getting stats for user ${userId}:`, error);
    return createDefaultStats(userId);
  }
}

// Get stats from file
function getStatsFromFile(userId) {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const data = fs.readFileSync(STATS_FILE, "utf8");
      const stats = JSON.parse(data);

      if (stats[userId]) {
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
async function getLeaderboardStats(timeframe, sortField, sortDirection, skip, limit) {
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
        if (sortField.includes("Profit") || sortField.includes("Wagered") || 
            sortField.includes("Won") || sortField.includes("Lost") || 
            sortField.includes("Donated")) {
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
  const parts = path.split('.');
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

module.exports = {
  getPlayerStats,
  updatePlayerStats,
  addDuelToHistory,
  getDuelHistory,
  loadStats,
  saveStats,
  debugStats,
  getLeaderboardStats, // Add the new function to exports
  statsCache, // Export the cache for direct access
  duelHistoryCache,
};
