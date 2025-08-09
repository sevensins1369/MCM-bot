// models/DiceGame.js
const mongoose = require('mongoose');

// Schema for an individual bet within a dice game
const DiceBetSchema = new mongoose.Schema({
    playerId: { type: String, required: true },
    amount: { type: String, required: true }, // Storing as String for BigInt
    currency: { type: String, required: true },
    betOn: { type: String, required: true }, // 'higher', 'lower', 'over', 'under', 'number'
    specificNumber: { type: Number, default: null },
}, { _id: false });

// Schema for an active dice game session
const DiceGameSchema = new mongoose.Schema({
  hostId: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  isOpen: { type: Boolean, default: true }, // To toggle betting
  bets: [DiceBetSchema], // Array to store all bets for this session
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.DiceGame || mongoose.model('DiceGame', DiceGameSchema);

// This schema defines the structure for a dice game session, including the host, active status, betting status, and an array of bets.
const PlayerStats = require('./PlayerStats');