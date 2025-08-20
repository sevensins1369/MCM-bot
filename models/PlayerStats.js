// models/PlayerStats.js
const mongoose = require("mongoose");

// Define a sub-schema for timeframe-based statistics
const timeframeStatsSchema = new mongoose.Schema({
  // Duel stats
  duelsWon: { type: Number, default: 0 },
  duelsLost: { type: Number, default: 0 },
  duelsHosted: { type: Number, default: 0 },
  osrsProfit: { type: String, default: "0" }, // BigInt as string
  rs3Profit: { type: String, default: "0" },
  osrsWagered: { type: String, default: "0" },
  rs3Wagered: { type: String, default: "0" },
  osrsDonated: { type: String, default: "0" },
  rs3Donated: { type: String, default: "0" },
  
  // Dice stats
  diceWon: { type: Number, default: 0 },
  diceLost: { type: Number, default: 0 },
  diceGamesHosted: { type: Number, default: 0 },
  diceOsrsProfit: { type: String, default: "0" },
  diceRs3Profit: { type: String, default: "0" },
  diceOsrsWagered: { type: String, default: "0" },
  diceRs3Wagered: { type: String, default: "0" },
  
  // Dice Duel stats
  diceDuelsWon: { type: Number, default: 0 },
  diceDuelsLost: { type: Number, default: 0 },
  diceDuelsHosted: { type: Number, default: 0 },
  diceDuelsOsrsProfit: { type: String, default: "0" },
  diceDuelsRs3Profit: { type: String, default: "0" },
  diceDuelsOsrsWagered: { type: String, default: "0" },
  diceDuelsRs3Wagered: { type: String, default: "0" },
  
  // Flower Game stats
  flowersWon: { type: Number, default: 0 },
  flowersLost: { type: Number, default: 0 },
  flowersHosted: { type: Number, default: 0 },
  flowersOsrsProfit: { type: String, default: "0" },
  flowersRs3Profit: { type: String, default: "0" },
  flowersOsrsWagered: { type: String, default: "0" },
  flowersRs3Wagered: { type: String, default: "0" },
  
  // Hot/Cold Game stats
  hotColdWon: { type: Number, default: 0 },
  hotColdLost: { type: Number, default: 0 },
  hotColdHosted: { type: Number, default: 0 },
  hotColdOsrsProfit: { type: String, default: "0" },
  hotColdRs3Profit: { type: String, default: "0" },
  hotColdOsrsWagered: { type: String, default: "0" },
  hotColdRs3Wagered: { type: String, default: "0" },
}, { _id: false });

// Main player stats schema with timeframe support
const playerStatsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  
  // Timeframe-based statistics
  allTime: { type: timeframeStatsSchema, default: () => ({}) },
  daily: { type: timeframeStatsSchema, default: () => ({}) },
  weekly: { type: timeframeStatsSchema, default: () => ({}) },
  monthly: { type: timeframeStatsSchema, default: () => ({}) },
  
  // Streak stats (global)
  currentDuelStreak: { type: Number, default: 0 },
  bestDuelStreak: { type: Number, default: 0 },
  currentDiceStreak: { type: Number, default: 0 },
  bestDiceStreak: { type: Number, default: 0 },
  currentDiceDuelStreak: { type: Number, default: 0 },
  bestDiceDuelStreak: { type: Number, default: 0 },
  currentFlowerStreak: { type: Number, default: 0 },
  bestFlowerStreak: { type: Number, default: 0 },
  currentHotColdStreak: { type: Number, default: 0 },
  bestHotColdStreak: { type: Number, default: 0 },
  
  // Reset timestamps for timeframe calculations
  dailyResetAt: { type: Date, default: () => getNextDayStart() },
  weeklyResetAt: { type: Date, default: () => getNextWeekStart() },
  monthlyResetAt: { type: Date, default: () => getNextMonthStart() },
  
}, { timestamps: true });

// Add indexes for performance
playerStatsSchema.index({ userId: 1 });
playerStatsSchema.index({ updatedAt: -1 });
playerStatsSchema.index({ 'allTime.osrsWagered': -1 });
playerStatsSchema.index({ 'allTime.rs3Wagered': -1 });
playerStatsSchema.index({ 'allTime.duelsWon': -1 });

// Helper functions for reset timestamps
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

module.exports = mongoose.models.PlayerStats || mongoose.model("PlayerStats", playerStatsSchema);
