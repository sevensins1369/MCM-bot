// models/FlowerGame.js
const mongoose = require("mongoose");

// Schema for flower bets
const FlowerBetSchema = new mongoose.Schema(
  {
    playerId: { type: String, required: true },
    amount: { type: String, required: true }, // Store as string for BigInt
    currency: { type: String, required: true },
    betType: { type: String, required: true }, // 'hot', 'cold', 'pair', 'rainbow', 'wildcard', etc.
    // For Rainbow Mania minigames
    minigameChoices: { type: [String], default: [] }, // Store user choices for minigames
    minigameResults: { type: Object, default: {} }, // Store results of minigames
  },
  { _id: false }
);

// Schema for flower games
const FlowerGameSchema = new mongoose.Schema({
  hostId: { type: String, required: true, unique: true },
  gameType: { type: String, required: true }, // 'hot_cold', 'pairs', 'custom', 'flower_poker', 'rainbow_mania'
  bets: [FlowerBetSchema],
  isOpen: { type: Boolean, default: true },
  selectedFlowers: [String],
  // For Flower Poker
  hostHand: { type: [String], default: [] }, // Host's 5 flowers
  playerHand: { type: [String], default: [] }, // Players' 5 flowers
  // For Rainbow Mania
  minigameActive: { type: Boolean, default: false },
  currentMinigame: { type: String, default: null },
  minigameData: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
});

module.exports =
  mongoose.models.FlowerGame || mongoose.model("FlowerGame", FlowerGameSchema);