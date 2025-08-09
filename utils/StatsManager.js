// utils/StatsManager.js
const mongoose = require("mongoose");
const Stats = require("../models/stats");

/**
 * Update a player's statistics
 * @param {string} userId - The user's Discord ID
 * @param {Object} stats - The stats to update
 * @returns {Object} The updated stats document
 */
async function updateStats(userId, stats) {
  try {
    // Check if stats is provided
    if (!stats || typeof stats !== "object") {
      console.warn(`Invalid stats object provided for user ${userId}`);
      stats = {}; // Use empty object as fallback
    }

    // Find the user's stats document or create a new one
    let userStats = await Stats.findOne({ userId });

    if (!userStats) {
      userStats = new Stats({
        userId,
        osrsWagered: "0",
        osrsWon: "0",
        osrsLost: "0",
        rs3Wagered: "0",
        rs3Won: "0",
        rs3Lost: "0",
        betsWon: 0,
        betsLost: 0,
        duelsWon: 0,
        duelsLost: 0,
        duelsHosted: 0,
        diceWon: 0,
        diceLost: 0,
        diceGamesHosted: 0,
        diceDuelsWon: 0,
        diceDuelsLost: 0,
        flowerGamesWon: 0,
        flowerGamesLost: 0,
        flowerGamesHosted: 0,
        currentDuelStreak: 0,
        bestDuelStreak: 0,
        currentDiceStreak: 0,
        bestDiceStreak: 0,
        currentDiceDuelStreak: 0,
        bestDiceDuelStreak: 0,
      });
    }

    // Update stats
    for (const [key, value] of Object.entries(stats)) {
      if (
        key.includes("Wagered") ||
        key.includes("Won") ||
        key.includes("Lost")
      ) {
        // Handle BigInt values
        if (typeof value === "bigint") {
          userStats[key] = (BigInt(userStats[key] || 0) + value).toString();
        } else {
          userStats[key] = (
            BigInt(userStats[key] || 0) + BigInt(value)
          ).toString();
        }
      } else {
        // Handle regular number values
        userStats[key] = (userStats[key] || 0) + value;
      }
    }

    // Update streaks
    if (stats.duelsWon > 0) {
      userStats.currentDuelStreak = (userStats.currentDuelStreak || 0) + 1;
      userStats.bestDuelStreak = Math.max(
        userStats.currentDuelStreak,
        userStats.bestDuelStreak || 0
      );
    } else if (stats.duelsLost > 0) {
      userStats.currentDuelStreak = 0;
    }

    if (stats.diceWon > 0) {
      userStats.currentDiceStreak = (userStats.currentDiceStreak || 0) + 1;
      userStats.bestDiceStreak = Math.max(
        userStats.currentDiceStreak,
        userStats.bestDiceStreak || 0
      );
    } else if (stats.diceLost > 0) {
      userStats.currentDiceStreak = 0;
    }

    if (stats.diceDuelsWon > 0) {
      userStats.currentDiceDuelStreak =
        (userStats.currentDiceDuelStreak || 0) + 1;
      userStats.bestDiceDuelStreak = Math.max(
        userStats.currentDiceDuelStreak,
        userStats.bestDiceDuelStreak || 0
      );
    } else if (stats.diceDuelsLost > 0) {
      userStats.currentDiceDuelStreak = 0;
    }

    // Save and return the updated stats
    await userStats.save();
    return userStats;
  } catch (error) {
    console.error(`Error updating stats for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Get a player's statistics
 * @param {string} userId - The user's Discord ID
 * @returns {Object} The player's stats document
 */
async function getPlayerStats(userId) {
  try {
    let userStats = await Stats.findOne({ userId });

    if (!userStats) {
      userStats = new Stats({
        userId,
        osrsWagered: "0",
        osrsWon: "0",
        osrsLost: "0",
        rs3Wagered: "0",
        rs3Won: "0",
        rs3Lost: "0",
        betsWon: 0,
        betsLost: 0,
        duelsWon: 0,
        duelsLost: 0,
        duelsHosted: 0,
        diceWon: 0,
        diceLost: 0,
        diceGamesHosted: 0,
        diceDuelsWon: 0,
        diceDuelsLost: 0,
        flowerGamesWon: 0,
        flowerGamesLost: 0,
        flowerGamesHosted: 0,
        currentDuelStreak: 0,
        bestDuelStreak: 0,
        currentDiceStreak: 0,
        bestDiceStreak: 0,
        currentDiceDuelStreak: 0,
        bestDiceDuelStreak: 0,
      });

      await userStats.save();
    }

    return userStats;
  } catch (error) {
    console.error(`Error getting stats for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Reset a player's streak
 * @param {string} userId - The user's Discord ID
 * @param {string} streakType - The type of streak to reset ('duel', 'dice', or 'diceDuel')
 * @returns {Object} The updated stats document
 */
async function resetStreak(userId, streakType) {
  try {
    let userStats = await Stats.findOne({ userId });

    if (!userStats) {
      return null;
    }

    if (streakType === "duel") {
      userStats.currentDuelStreak = 0;
    } else if (streakType === "dice") {
      userStats.currentDiceStreak = 0;
    } else if (streakType === "diceDuel") {
      userStats.currentDiceDuelStreak = 0;
    }

    await userStats.save();
    return userStats;
  } catch (error) {
    console.error(
      `Error resetting ${streakType} streak for user ${userId}:`,
      error
    );
    throw error;
  }
}

/**
 * Get leaderboard data
 * @param {string} currency - The currency to get leaderboard for ('osrs' or 'rs3')
 * @param {string} category - The category to sort by ('wagered', 'won', or 'lost')
 * @param {string} timeframe - The timeframe to filter by ('daily', 'weekly', 'monthly', or 'allTime')
 * @param {number} limit - The maximum number of results to return
 * @param {number} page - The page number for pagination
 * @returns {Array} The leaderboard data
 */
async function getLeaderboard(
  currency,
  category,
  timeframe = "allTime",
  limit = 10,
  page = 1
) {
  try {
    const skip = (page - 1) * limit;
    const sortField = `${currency}${
      category.charAt(0).toUpperCase() + category.slice(1)
    }`;

    // Get date range for timeframe
    const now = new Date();
    let startDate;

    if (timeframe === "daily") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (timeframe === "weekly") {
      const day = now.getDay() || 7; // Convert Sunday (0) to 7
      startDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - day + 1
      );
    } else if (timeframe === "monthly") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      // All time - no date filter
      startDate = null;
    }

    let query = {};
    if (startDate) {
      query.updatedAt = { $gte: startDate };
    }

    // Add condition to filter out zero values
    query[sortField] = { $gt: "0" };

    const leaderboard = await Stats.find(query)
      .sort({ [sortField]: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return leaderboard;
  } catch (error) {
    console.error(`Error getting ${currency} ${category} leaderboard:`, error);
    throw error;
  }
}

module.exports = {
  updateStats,
  updatePlayerStats: updateStats, // Create an alias
  getPlayerStats,
  resetStreak,
  getLeaderboard,
};
