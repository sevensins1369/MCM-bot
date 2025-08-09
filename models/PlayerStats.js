// models/PlayerStats.js
const mongoose = require("mongoose");

const DuelHistoryEntrySchema = new mongoose.Schema(
  {
    type: String,
    result: {
      type: String,
      enum: ["win", "loss"],
    },
    opponent: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const PlayerStatsSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  gamesPlayed: {
    type: Number,
    default: 0,
  },
  gamesWon: {
    type: Number,
    default: 0,
  },
  gamesLost: {
    type: Number,
    default: 0,
  },
  betsPlaced: {
    type: Number,
    default: 0,
  },
  betsWon: {
    type: Number,
    default: 0,
  },
  betsLost: {
    type: Number,
    default: 0,
  },
  duelsWon: {
    type: Number,
    default: 0,
  },
  duelsLost: {
    type: Number,
    default: 0,
  },
  duelsHosted: {
    type: Number,
    default: 0,
  },
  osrsWagered: {
    type: String,
    default: "0",
  },
  osrsWon: {
    type: String,
    default: "0",
  },
  osrsLost: {
    type: String,
    default: "0",
  },
  rs3Wagered: {
    type: String,
    default: "0",
  },
  rs3Won: {
    type: String,
    default: "0",
  },
  rs3Lost: {
    type: String,
    default: "0",
  },
  duelHistory: [DuelHistoryEntrySchema],
  lastPlayed: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const PlayerStats =
  mongoose.connection.readyState === 1
    ? mongoose.models.PlayerStats ||
      mongoose.model("PlayerStats", PlayerStatsSchema)
    : null;

module.exports = PlayerStats;
