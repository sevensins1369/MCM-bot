// models/Jackpot.js
const mongoose = require("mongoose");

const JackpotSchema = new mongoose.Schema({
  gameId: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ["active", "drawing", "completed", "cancelled"],
    default: "active",
  },
  startTime: {
    type: Date,
    default: Date.now,
  },
  endTime: {
    type: Date,
    default: null,
  },
  drawTime: {
    type: Date,
    required: true,
  },
  currency: {
    type: String,
    enum: ["osrs", "rs3"],
    required: true,
  },
  minEntryAmount: {
    type: String, // Using string to handle large numbers
    required: true,
  },
  totalPot: {
    type: String, // Using string to handle large numbers
    default: "0",
  },
  entries: [
    {
      userId: {
        type: String,
        required: true,
      },
      username: {
        type: String,
        required: true,
      },
      amount: {
        type: String, // Using string to handle large numbers
        required: true,
      },
      entryTime: {
        type: Date,
        default: Date.now,
      },
      tickets: {
        type: Number,
        required: true,
      },
    },
  ],
  winner: {
    userId: {
      type: String,
      default: null,
    },
    username: {
      type: String,
      default: null,
    },
    amount: {
      type: String, // Using string to handle large numbers
      default: null,
    },
    winningTicket: {
      type: Number,
      default: null,
    },
    totalTickets: {
      type: Number,
      default: null,
    },
  },
  messageId: {
    type: String,
    default: null,
  },
  channelId: {
    type: String,
    default: null,
  },
  serverId: {
    type: String,
    default: null,
  },
  createdBy: {
    type: String,
    required: true,
  },
});

// Create indexes for better performance
JackpotSchema.index({ gameId: 1 });
JackpotSchema.index({ status: 1 });
JackpotSchema.index({ drawTime: 1 });
JackpotSchema.index({ "entries.userId": 1 });

const Jackpot =
  mongoose.connection.readyState === 1
    ? mongoose.models.Jackpot || mongoose.model("Jackpot", JackpotSchema)
    : null;

module.exports = Jackpot;
