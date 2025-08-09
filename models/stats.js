// models/stats.js
const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    
    // Currency stats (stored as strings to handle BigInt)
    osrsWagered: { type: String, default: '0' },
    osrsWon: { type: String, default: '0' },
    osrsLost: { type: String, default: '0' },
    rs3Wagered: { type: String, default: '0' },
    rs3Won: { type: String, default: '0' },
    rs3Lost: { type: String, default: '0' },
    
    // Game stats
    betsWon: { type: Number, default: 0 },
    betsLost: { type: Number, default: 0 },
    duelsWon: { type: Number, default: 0 },
    duelsLost: { type: Number, default: 0 },
    duelsHosted: { type: Number, default: 0 },
    diceWon: { type: Number, default: 0 },
    diceLost: { type: Number, default: 0 },
    diceGamesHosted: { type: Number, default: 0 },
    diceDuelsWon: { type: Number, default: 0 },
    diceDuelsLost: { type: Number, default: 0 },
    flowerGamesWon: { type: Number, default: 0 },
    flowerGamesLost: { type: Number, default: 0 },
    flowerGamesHosted: { type: Number, default: 0 },
    
    // Streak stats
    currentDuelStreak: { type: Number, default: 0 },
    bestDuelStreak: { type: Number, default: 0 },
    currentDiceStreak: { type: Number, default: 0 },
    bestDiceStreak: { type: Number, default: 0 },
    currentDiceDuelStreak: { type: Number, default: 0 },
    bestDiceDuelStreak: { type: Number, default: 0 },
    
    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.Stats || mongoose.model('Stats', statsSchema);
