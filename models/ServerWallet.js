// models/ServerWallet.js
const mongoose = require("mongoose");

const ServerWalletSchema = new mongoose.Schema({
  serverId: {
    type: String,
    required: true,
    unique: true,
  },
  guildId: {
    type: String,
    required: false, // For backward compatibility
    unique: false,
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
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Create indexes for better performance
ServerWalletSchema.index({ serverId: 1 });
ServerWalletSchema.index({ guildId: 1 });

// Pre-save middleware to ensure serverId is always set
ServerWalletSchema.pre("save", function (next) {
  // If serverId is not set but guildId is, use guildId as serverId
  if (!this.serverId && this.guildId) {
    this.serverId = this.guildId;
  }
  next();
});

const ServerWallet =
  mongoose.connection.readyState === 1
    ? mongoose.models.ServerWallet ||
      mongoose.model("ServerWallet", ServerWalletSchema)
    : null;

module.exports = ServerWallet;
