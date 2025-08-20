// check-models.js
// This script checks for missing model files and creates them if needed

const fs = require("fs");
const path = require("path");

console.log("Checking for missing model files...");

// Ensure models directory exists
const modelsDir = path.join(__dirname, "models");
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
  console.log("Created models directory");
}

// Define model files that should exist
const requiredModels = [
  {
    name: "Wallet.js",
    content: `// models/Wallet.js
const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  // Store large numbers as strings in the DB
  07: { 
    type: String, 
    default: '0' 
  },
  rs3: { 
    type: String, 
    default: '0' 
  },
  isPrivate: { 
    type: Boolean, 
    default: false 
  },
  isLocked: { 
    type: Boolean, 
    default: false 
  },
  lockExpiresAt: { 
    type: Date, 
    default: null 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Create indexes for better performance
WalletSchema.index({ userId: 1 });

const Wallet = mongoose.connection.readyState === 1 ? 
  (mongoose.models.Wallet || mongoose.model('Wallet', WalletSchema)) : null;

module.exports = Wallet;`,
  },
  {
    name: "duel.js",
    content: `// models/duel.js
const mongoose = require('mongoose');

const DuelSchema = new mongoose.Schema({
  hostId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['whip', 'boxing', 'poly', 'dds', 'ags', 'dharok', 'custom'],
    default: 'whip'
  },
  isOpen: {
    type: Boolean,
    default: true
  },
  isComplete: {
    type: Boolean,
    default: false
  },
  winner: {
    type: String,
    enum: ['host', 'opponent', null],
    default: null
  },
  messageId: {
    type: String,
    default: null
  },
  channelId: {
    type: String,
    default: null
  },
  bets: [{
    playerId: String,
    playerName: String,
    amount: String, // Using string to handle large numbers
    currency: {
      type: String,
      enum: ['07', 'rs3'],
      default: '07'
    },
    side: {
      type: String,
      enum: ['host', 'opponent'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  }
});

// Create indexes for better performance
DuelSchema.index({ hostId: 1, isComplete: 1 });
DuelSchema.index({ createdAt: -1 });

const Duel = mongoose.connection.readyState === 1 ? 
  (mongoose.models.Duel || mongoose.model('Duel', DuelSchema)) : null;

module.exports = Duel;`,
  },
  {
    name: "playerstats.js",
    content: `// models/playerstats.js
const mongoose = require('mongoose');

const PlayerStatsSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  // Game stats
  gamesPlayed: {
    type: Number,
    default: 0
  },
  gamesWon: {
    type: Number,
    default: 0
  },
  gamesLost: {
    type: Number,
    default: 0
  },
  // Betting stats
  betsPlaced: {
    type: Number,
    default: 0
  },
  betsWon: {
    type: Number,
    default: 0
  },
  betsLost: {
    type: Number,
    default: 0
  },
  // Currency stats (stored as strings to handle large numbers)
  07Wagered: {
    type: String,
    default: '0'
  },
  07Won: {
    type: String,
    default: '0'
  },
  07Lost: {
    type: String,
    default: '0'
  },
  rs3Wagered: {
    type: String,
    default: '0'
  },
  rs3Won: {
    type: String,
    default: '0'
  },
  rs3Lost: {
    type: String,
    default: '0'
  },
  // Timestamps
  lastPlayed: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create indexes for better performance
PlayerStatsSchema.index({ userId: 1 });
PlayerStatsSchema.index({ 07Wagered: -1 });
PlayerStatsSchema.index({ rs3Wagered: -1 });

const PlayerStats = mongoose.connection.readyState === 1 ? 
  (mongoose.models.PlayerStats || mongoose.model('PlayerStats', PlayerStatsSchema)) : null;

module.exports = PlayerStats;`,
  },
  {
    name: "UserPreferences.js",
    content: `// models/UserPreferences.js
const mongoose = require('mongoose');

const UserPreferencesSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  defaultCurrency: {
    type: String,
    enum: ['07', 'rs3'],
    default: '07'
  },
  twitchUsername: {
    type: String,
    default: null
  },
  flowerPreference: {
    type: String,
    default: 'random'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create indexes for better performance
UserPreferencesSchema.index({ userId: 1 });

const UserPreferences = mongoose.connection.readyState === 1 ? 
  (mongoose.models.UserPreferences || mongoose.model('UserPreferences', UserPreferencesSchema)) : null;

module.exports = UserPreferences;`,
  },
  {
    name: "trigger.js",
    content: `// models/trigger.js
const mongoose = require('mongoose');

const TriggerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  response: {
    type: String,
    required: true
  },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Trigger = mongoose.connection.readyState === 1 ? 
  (mongoose.models.Trigger || mongoose.model('Trigger', TriggerSchema)) : null;

module.exports = Trigger;`,
  },
  {
    name: "ServerWallet.js",
    content: `// models/ServerWallet.js
const mongoose = require('mongoose');

const ServerWalletSchema = new mongoose.Schema({
  serverId: {
    type: String,
    required: true,
    unique: true
  },
  // Store large numbers as strings in the DB
  07: {
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

module.exports = ServerWallet;`,
  },
  {
    name: "Jackpot.js",
    content: `// models/Jackpot.js
const mongoose = require('mongoose');

const JackpotSchema = new mongoose.Schema({
  gameId: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['active', 'drawing', 'completed', 'cancelled'],
    default: 'active'
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date,
    default: null
  },
  drawTime: {
    type: Date,
    required: true
  },
  currency: {
    type: String,
    enum: ['07', 'rs3'],
    required: true
  },
  minEntryAmount: {
    type: String, // Using string to handle large numbers
    required: true
  },
  totalPot: {
    type: String, // Using string to handle large numbers
    default: '0'
  },
  entries: [{
    userId: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    },
    amount: {
      type: String, // Using string to handle large numbers
      required: true
    },
    entryTime: {
      type: Date,
      default: Date.now
    },
    tickets: {
      type: Number,
      required: true
    }
  }],
  winner: {
    userId: {
      type: String,
      default: null
    },
    username: {
      type: String,
      default: null
    },
    amount: {
      type: String, // Using string to handle large numbers
      default: null
    },
    winningTicket: {
      type: Number,
      default: null
    },
    totalTickets: {
      type: Number,
      default: null
    }
  },
  messageId: {
    type: String,
    default: null
  },
  channelId: {
    type: String,
    default: null
  },
  serverId: {
    type: String,
    default: null
  },
  createdBy: {
    type: String,
    required: true
  }
});

// Create indexes for better performance
JackpotSchema.index({ gameId: 1 });
JackpotSchema.index({ status: 1 });
JackpotSchema.index({ drawTime: 1 });
JackpotSchema.index({ 'entries.userId': 1 });

const Jackpot = mongoose.connection.readyState === 1 ? 
  (mongoose.models.Jackpot || mongoose.model('Jackpot', JackpotSchema)) : null;

module.exports = Jackpot;`,
  },
];

// Check each required model and create if missing
let createdCount = 0;
for (const model of requiredModels) {
  const modelPath = path.join(modelsDir, model.name);
  if (!fs.existsSync(modelPath)) {
    fs.writeFileSync(modelPath, model.content);
    console.log(`Created missing model file: ${model.name}`);
    createdCount++;
  }
}

if (createdCount === 0) {
  console.log("All model files are present.");
} else {
  console.log(`Created ${createdCount} missing model files.`);
}

console.log("Model check complete!");
