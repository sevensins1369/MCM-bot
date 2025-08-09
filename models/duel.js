// models/duel.js
const mongoose = require("mongoose");

const DuelSchema = new mongoose.Schema({
  hostId: {
    type: String,
    required: true,
    index: true,
  },
  opponentId: {
    type: String,
    default: null,
  },
  type: {
    type: String,
    required: true,
    enum: ["whip", "boxing", "poly", "dds", "ags", "dharok", "custom"],
    default: "whip",
  },
  isOpen: {
    type: Boolean,
    default: true,
  },
  isComplete: {
    type: Boolean,
    default: false,
  },
  winner: {
    type: String,
    enum: ["host", "opponent", null],
    default: null,
  },
  messageId: {
    type: String,
    default: null,
  },
  channelId: {
    type: String,
    default: null,
  },
  bets: [
    {
      playerId: String,
      playerName: String,
      amount: String, // Using string to handle large numbers
      currency: {
        type: String,
        enum: ["osrs", "rs3"],
        default: "osrs",
      },
      side: {
        type: String,
        enum: ["host", "opponent"],
        required: true,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
    default: null,
  },
});

// Create indexes for better performance
DuelSchema.index({ hostId: 1, isComplete: 1 });
DuelSchema.index({ opponentId: 1, isComplete: 1 });
DuelSchema.index({ createdAt: -1 });

const Duel =
  mongoose.connection.readyState === 1
    ? mongoose.models.Duel || mongoose.model("Duel", DuelSchema)
    : null;

module.exports = Duel;
