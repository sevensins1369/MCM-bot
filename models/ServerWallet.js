// models/ServerWallet.js
const mongoose = require('mongoose');

const ServerWalletSchema = new mongoose.Schema({
  serverId: {
    type: String,
    required: true,
    unique: true
  },
  // Store large numbers as strings in the DB
  osrs: {
    type: String,
    default: '0'
  },
  rs3: {
    type: String,
    default: '0'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create indexes for better performance
ServerWalletSchema.index({ serverId: 1 });

const ServerWallet = mongoose.connection.readyState === 1 ? 
  (mongoose.models.ServerWallet || mongoose.model('ServerWallet', ServerWalletSchema)) : null;

module.exports = ServerWallet;