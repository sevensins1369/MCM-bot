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
  rollResult: { type: Number, default: null }, // Store the final dice roll
  gameCompleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Add indexes for performance
DiceGameSchema.index({ hostId: 1 });
DiceGameSchema.index({ isActive: 1 });
DiceGameSchema.index({ isOpen: 1 });
DiceGameSchema.index({ gameCompleted: 1 });
DiceGameSchema.index({ createdAt: -1 });
DiceGameSchema.index({ "bets.playerId": 1 }); // Index for bet queries

module.exports = mongoose.models.DiceGame || mongoose.model('DiceGame', DiceGameSchema);
