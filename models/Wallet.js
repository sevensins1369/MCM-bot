// models/Wallet.js
const mongoose = require("mongoose");

const WalletSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  // Store large numbers as strings in the DB
  osrs: {
    type: String,
    default: "0",
  },
  rs3: {
    type: String,
    default: "0",
  },
  isPrivate: {
    type: Boolean,
    default: false,
  },
  isLocked: {
    type: Boolean,
    default: false,
  },
  lockExpiresAt: {
    type: Date,
    default: null,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Create comprehensive indexes for better performance
WalletSchema.index({ userId: 1 }, { unique: true });
WalletSchema.index({ updatedAt: -1 });
WalletSchema.index({ isLocked: 1 });
WalletSchema.index({ lockExpiresAt: 1 });
WalletSchema.index({ isPrivate: 1 });

const Wallet =
  mongoose.connection.readyState === 1
    ? mongoose.models.Wallet || mongoose.model("Wallet", WalletSchema)
    : null;

module.exports = Wallet;
