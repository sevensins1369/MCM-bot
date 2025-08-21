// utils/DiceManager.js
const fs = require("fs");
const path = require("path");
const { updateWallet, getWallet } = require("./WalletManager");
const { updatePlayerStats } = require("./PlayerStatsManager");
const { formatAmount } = require("./embedcreator");
const { logger } = require("./enhanced-logger");
const {
  ValidationError,
  DatabaseError,
  safeDbOperation,
} = require("./error-handler");
const mongoose = require("mongoose");
const DiceGame = require("../models/DiceGame");

// In-memory storage for active dice games
const activeGames = new Map();
const activeDiceGames = new Map(); // For hosting dice tables

// File path for storing active games
const GAMES_FILE = path.join(__dirname, "/container/data/activeGames.json");
const DICE_TABLES_FILE = path.join(__dirname, "/container/data/diceTables.json");

/**
 * Load active dice games from file
 */
async function loadActiveDiceGames() {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(GAMES_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Load individual dice games
    if (fs.existsSync(GAMES_FILE)) {
      const data = fs.readFileSync(GAMES_FILE, "utf8");
      const games = JSON.parse(data);

      Object.entries(games).forEach(([gameId, game]) => {
        activeGames.set(gameId, {
          ...game,
          timestamp: new Date(game.timestamp),
        });
      });

      logger.info(
        "DiceManager",
        `Loaded ${activeGames.size} active dice games`
      );

      // Clean up old games (older than 1 hour)
      cleanupOldGames();
    } else {
      logger.info(
        "DiceManager",
        "No active games file found. Starting with empty games."
      );
      saveActiveDiceGames();
    }

    // Load dice tables
    if (fs.existsSync(DICE_TABLES_FILE)) {
      const data = fs.readFileSync(DICE_TABLES_FILE, "utf8");
      const tables = JSON.parse(data);

      Object.entries(tables).forEach(([hostId, table]) => {
        activeDiceGames.set(hostId, {
          ...table,
          createdAt: new Date(table.createdAt),
        });
      });

      logger.info(
        "DiceManager",
        `Loaded ${activeDiceGames.size} active dice tables`
      );
    } else {
      logger.info(
        "DiceManager",
        "No active dice tables file found. Starting with empty tables."
      );
      saveDiceTables();
    }
  } catch (error) {
    logger.error("DiceManager", "Error loading active dice games", error);
    // Create empty files if there was an error
    saveActiveDiceGames();
    saveDiceTables();
  }
}

/**
 * Save active dice games to file
 */
function saveActiveDiceGames() {
  try {
    const games = {};
    activeGames.forEach((game, gameId) => {
      games[gameId] = game;
    });

    fs.writeFileSync(GAMES_FILE, JSON.stringify(games, null, 2));
  } catch (error) {
    logger.error("DiceManager", "Error saving active dice games", error);
  }
}

/**
 * Save dice tables to file
 */
function saveDiceTables() {
  try {
    const tables = {};
    activeDiceGames.forEach((table, hostId) => {
      tables[hostId] = table;
    });

    fs.writeFileSync(DICE_TABLES_FILE, JSON.stringify(tables, null, 2));
  } catch (error) {
    logger.error("DiceManager", "Error saving dice tables", error);
  }
}

/**
 * Clean up old games (older than 1 hour)
 */
function cleanupOldGames() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  let cleanedCount = 0;
  activeGames.forEach((game, gameId) => {
    if (game.timestamp < oneHourAgo) {
      activeGames.delete(gameId);
      cleanedCount++;
    }
  });

  if (cleanedCount > 0) {
    logger.info("DiceManager", `Cleaned up ${cleanedCount} old dice games`);
    saveActiveDiceGames();
  }
}

/**
 * Create a new dice game
 * @param {string} userId - The user's Discord ID
 * @param {string} amount - The bet amount
 * @param {string} currency - The currency (osrs or rs3)
 * @returns {Promise<Object>} The created game
 */
async function createDiceGame(userId, amount, currency) {
  try {
    // Validate currency
    if (currency !== "osrs" && currency !== "rs3") {
      return {
        success: false,
        message: 'Invalid currency. Must be "osrs" or "rs3".',
      };
    }

    // Convert amount to BigInt for accurate comparison
    let betAmount;
    try {
      betAmount = BigInt(amount);
    } catch (error) {
      return { success: false, message: "Invalid bet amount." };
    }

    // Check if bet amount is positive
    if (betAmount <= 0n) {
      return { success: false, message: "Bet amount must be positive." };
    }

    // Get user's wallet
    const wallet = await getWallet(userId);

    // Check if wallet is locked
    if (
      wallet.isLocked &&
      wallet.lockExpiresAt &&
      new Date() < new Date(wallet.lockExpiresAt)
    ) {
      return {
        success: false,
        message: `Your wallet is locked until ${new Date(
          wallet.lockExpiresAt
        ).toLocaleString()}.`,
      };
    }

    // Check if user has enough balance
    const balance = BigInt(wallet[currency]);
    if (balance < betAmount) {
      return {
        success: false,
        message: `You don't have enough ${currency.toUpperCase()} to place this bet.`,
      };
    }

    // Deduct bet amount from wallet
    await updateWallet(userId, { [currency]: `-${betAmount}` }, "DiceGame:Bet");

    // Generate game ID
    const gameId = `dice_${userId}_${Date.now()}`;

    // Create game
    const game = {
      id: gameId,
      userId,
      amount: betAmount.toString(),
      currency,
      timestamp: new Date(),
      status: "pending",
    };

    // Store game
    activeGames.set(gameId, game);
    saveActiveDiceGames();

    // Update player stats
    await updatePlayerStats(userId, {
      gamesPlayed: 1,
      [`${currency}Wagered`]: betAmount.toString(),
    });

    return { success: true, game };
  } catch (error) {
    logger.error("DiceManager", "Error creating dice game", {
      error,
      userId,
      amount,
      currency,
    });

    return {
      success: false,
      message: "An error occurred while creating the dice game.",
    };
  }
}

/**
 * Roll dice for a game
 * @param {string} gameId - The game ID
 * @returns {Promise<Object>} The roll result
 */
async function rollDice(gameId) {
  try {
    // Check if game exists
    if (!activeGames.has(gameId)) {
      return { success: false, message: "Game not found." };
    }

    const game = activeGames.get(gameId);

    // Check if game is already completed
    if (game.status !== "pending") {
      return { success: false, message: "Game is already completed." };
    }

    // Generate random roll (1-100)
    const roll = Math.floor(Math.random() * 100) + 1;

    // Determine if player won (roll > 55 is a win, 55% house edge)
    const win = roll > 55;

    // Calculate winnings
    const betAmount = BigInt(game.amount);
    const winnings = win ? betAmount * 2n : 0n;

    // Update game status
    game.status = win ? "won" : "lost";
    game.roll = roll;
    game.winnings = winnings.toString();

    // Save game
    activeGames.set(gameId, game);
    saveActiveDiceGames();

    // Update player stats
    if (win) {
      await updatePlayerStats(game.userId, {
        gamesWon: 1,
        [`${game.currency}Won`]: betAmount.toString(),
      });

      // Add winnings to wallet
      await updateWallet(
        game.userId,
        { [game.currency]: `+${winnings}` },
        "DiceGame:Win"
      );
    } else {
      await updatePlayerStats(game.userId, {
        gamesLost: 1,
        [`${game.currency}Lost`]: betAmount.toString(),
      });
    }

    // Log the result
    logger.info("DiceManager", `Dice game ${gameId} completed`, {
      userId: game.userId,
      amount: game.amount,
      currency: game.currency,
      roll,
      win,
      winnings: win ? winnings.toString() : "0",
    });

    return { success: true, game, roll, win };
  } catch (error) {
    logger.error("DiceManager", "Error rolling dice", {
      error,
      gameId,
    });

    return {
      success: false,
      message: "An error occurred while rolling the dice.",
    };
  }
}

/**
 * Get a dice game by ID
 * @param {string} gameId - The game ID
 * @returns {Object|null} The game object or null if not found
 */
function getDiceGame(gameId) {
  return activeGames.get(gameId) || null;
}

/**
 * Get all active dice games for a user
 * @param {string} userId - The user's Discord ID
 * @returns {Array} Array of game objects
 */
function getUserDiceGames(userId) {
  const games = [];
  activeGames.forEach((game) => {
    if (game.userId === userId) {
      games.push(game);
    }
  });
  return games;
}

/**
 * Get dice game statistics
 * @returns {Object} Statistics about dice games
 */
function getDiceGameStats() {
  let totalGames = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let totalOsrsWagered = BigInt(0);
  let totalRs3Wagered = BigInt(0);

  activeGames.forEach((game) => {
    totalGames++;

    if (game.status === "won") {
      totalWins++;
    } else if (game.status === "lost") {
      totalLosses++;
    }

    if (game.currency === "osrs") {
      totalOsrsWagered += BigInt(game.amount);
    } else if (game.currency === "rs3") {
      totalRs3Wagered += BigInt(game.amount);
    }
  });

  return {
    totalGames,
    totalWins,
    totalLosses,
    totalOsrsWagered: totalOsrsWagered.toString(),
    totalRs3Wagered: totalRs3Wagered.toString(),
    winRate: totalGames > 0 ? (totalWins / totalGames) * 100 : 0,
  };
}

// ============= DICE TABLE FUNCTIONS =============

/**
 * Start a new dice game table
 * @param {string} hostId - The host's Discord ID
 * @returns {Promise<Object>} Result object with success status and game data
 */
async function startDiceGame(hostId) {
  try {
    // Check if host already has an active game
    if (activeDiceGames.has(hostId)) {
      return {
        success: false,
        message: "You already have an active dice table.",
      };
    }

    // Create a new dice game
    const newGame = {
      hostId,
      isActive: true,
      isOpen: true,
      bets: [],
      createdAt: new Date(),
    };

    // Store in memory
    activeDiceGames.set(hostId, newGame);

    // Save to file
    saveDiceTables();

    // Store in database if available
    try {
      if (mongoose.connection.readyState === 1) {
        await DiceGame.create(newGame);
      }
    } catch (dbError) {
      logger.error(
        "DiceManager",
        "Failed to save dice game to database",
        dbError
      );
      // Continue with in-memory version
    }

    return { success: true, game: newGame };
  } catch (error) {
    logger.error("DiceManager", "Error starting dice game", error);
    return {
      success: false,
      message: "An error occurred while creating the dice table.",
    };
  }
}

/**
 * Toggle betting status for a dice game
 * @param {string} hostId - The host's Discord ID
 * @returns {Promise<Object>} Result object with success status and open status
 */
async function toggleDiceBetting(hostId) {
  try {
    // Get the dice game
    const game = activeDiceGames.get(hostId);
    if (!game) {
      return {
        success: false,
        message: "You don't have an active dice table.",
      };
    }

    // Toggle betting status
    game.isOpen = !game.isOpen;

    // Save to file
    saveDiceTables();

    // Update in database if available
    try {
      if (mongoose.connection.readyState === 1) {
        await DiceGame.updateOne(
          { hostId, isActive: true },
          { $set: { isOpen: game.isOpen } }
        );
      }
    } catch (dbError) {
      logger.error(
        "DiceManager",
        "Failed to update dice game in database",
        dbError
      );
      // Continue with in-memory version
    }

    return { success: true, isOpen: game.isOpen };
  } catch (error) {
    logger.error("DiceManager", "Error toggling dice betting", error);
    return {
      success: false,
      message: "An error occurred while toggling betting status.",
    };
  }
}

/**
 * Cancel a dice game
 * @param {string} hostId - The host's Discord ID
 * @returns {Promise<Object>} Result object with success status
 */
async function cancelDiceGame(hostId) {
  try {
    // Get the dice game
    const game = activeDiceGames.get(hostId);
    if (!game) {
      return {
        success: false,
        message: "You don't have an active dice table.",
      };
    }

    // Refund all bets
    for (const bet of game.bets) {
      try {
        const playerWallet = await getWallet(bet.playerId);
        playerWallet[bet.currency] =
          BigInt(playerWallet[bet.currency]) + BigInt(bet.amount);
        await updateWallet(bet.playerId, playerWallet);
      } catch (refundError) {
        logger.error(
          "DiceManager",
          `Error refunding bet for player ${bet.playerId}`,
          refundError
        );
      }
    }

    // Remove from memory
    activeDiceGames.delete(hostId);

    // Save to file
    saveDiceTables();

    // Remove from database if available
    try {
      if (mongoose.connection.readyState === 1) {
        await DiceGame.deleteOne({ hostId, isActive: true });
      }
    } catch (dbError) {
      logger.error(
        "DiceManager",
        "Failed to delete dice game from database",
        dbError
      );
      // Continue with in-memory version
    }

    return { success: true };
  } catch (error) {
    logger.error("DiceManager", "Error cancelling dice game", error);
    return {
      success: false,
      message: "An error occurred while cancelling the dice table.",
    };
  }
}

/**
 * Get an active dice game
 * @param {string} hostId - The host's Discord ID
 * @returns {Object|null} The dice game or null if not found
 */
function getActiveDiceGame(hostId) {
  return activeDiceGames.get(hostId);
}

/**
 * Place a bet on a dice game
 * @param {string} playerId - The player's Discord ID
 * @param {string} hostId - The host's Discord ID
 * @param {string} amount - The bet amount
 * @param {string} currency - The currency to bet with
 * @param {string} betOn - What to bet on ('higher', 'lower', 'over', 'under', 'number')
 * @param {number|null} specificNumber - The specific number to bet on (if betOn is 'number')
 * @returns {Promise<Object>} Result object with success status
 */
async function placeBet(
  playerId,
  hostId,
  amount,
  currency,
  betOn,
  specificNumber = null
) {
  try {
    // Get the dice game
    const game = activeDiceGames.get(hostId);
    if (!game) {
      return {
        success: false,
        message: "This host does not have an active dice table.",
      };
    }

    if (!game.isOpen) {
      return {
        success: false,
        message: "Betting is closed for this dice table.",
      };
    }

    // Validate bet type
    const validBetTypes = ["higher", "lower", "over", "under", "number"];
    if (!validBetTypes.includes(betOn)) {
      return { success: false, message: "Invalid bet type." };
    }

    // Validate specific number if betting on a number
    if (
      betOn === "number" &&
      (specificNumber === null || specificNumber < 1 || specificNumber > 100)
    ) {
      return {
        success: false,
        message:
          "When betting on a number, you must specify a valid number between 1 and 100.",
      };
    }

    // Get player wallet
    const playerWallet = await getWallet(playerId);

    // Check if player has enough funds
    if (BigInt(playerWallet[currency]) < BigInt(amount)) {
      return {
        success: false,
        message: `You don't have enough ${currency.toUpperCase()} for this bet.`,
      };
    }

    // Deduct amount from wallet
    playerWallet[currency] = BigInt(playerWallet[currency]) - BigInt(amount);
    await updateWallet(playerId, playerWallet);

    // Add bet to game
    const bet = {
      playerId,
      amount: amount.toString(),
      currency,
      betOn,
      specificNumber,
    };

    game.bets.push(bet);

    // Save to file
    saveDiceTables();

    // Update in database if available
    try {
      if (mongoose.connection.readyState === 1) {
        await DiceGame.updateOne(
          { hostId, isActive: true },
          { $push: { bets: bet } }
        );
      }
    } catch (dbError) {
      logger.error(
        "DiceManager",
        "Failed to update dice game in database",
        dbError
      );
      // Continue with in-memory version
    }

    return { success: true };
  } catch (error) {
    logger.error("DiceManager", "Error placing bet", error);
    return {
      success: false,
      message: "An error occurred while placing your bet.",
    };
  }
}

/**
 * Get winners from a dice game based on roll result
 * @param {string} hostId - The host's Discord ID
 * @param {number} roll - The roll result (1-100)
 * @returns {Array} Array of winner objects
 */
function getWinnersFromDiceGame(hostId, roll) {
  const game = activeDiceGames.get(hostId);
  if (!game) {
    return [];
  }

  const winners = [];

  for (const bet of game.bets) {
    let isWinner = false;
    let multiplier = 0;

    switch (bet.betOn) {
      case "higher":
        isWinner = roll > 50;
        multiplier = 2; // 1:1 payout
        break;
      case "lower":
        isWinner = roll < 50;
        multiplier = 2; // 1:1 payout
        break;
      case "over":
        isWinner = roll >= 75;
        multiplier = 4; // 3:1 payout
        break;
      case "under":
        isWinner = roll <= 25;
        multiplier = 4; // 3:1 payout
        break;
      case "number":
        isWinner = roll === bet.specificNumber;
        multiplier = 100; // 99:1 payout
        break;
    }

    if (isWinner) {
      const betAmount = BigInt(bet.amount);
      const winnings = betAmount * BigInt(multiplier);

      winners.push({
        playerId: bet.playerId,
        osrsWinnings: bet.currency === "osrs" ? winnings : 0n,
        rs3Winnings: bet.currency === "rs3" ? winnings : 0n,
      });
    }
  }

  return winners;
}

/**
 * Complete a dice game with a roll result
 * @param {string} hostId - The host's Discord ID
 * @param {number} roll - The roll result (1-100)
 * @returns {Promise<Object>} Result object with success status and bets
 */
async function completeDiceGame(hostId, roll) {
  try {
    // Get the dice game
    const game = activeDiceGames.get(hostId);
    if (!game) {
      return {
        success: false,
        message: "You don't have an active dice table.",
      };
    }

    // Add roll to history
    await addRollToHistory(hostId, roll);

    // Process bets
    for (const bet of game.bets) {
      try {
        let isWinner = false;
        let multiplier = 0;

        switch (bet.betOn) {
          case "higher":
            isWinner = roll > 50;
            multiplier = 2; // 1:1 payout
            break;
          case "lower":
            isWinner = roll < 50;
            multiplier = 2; // 1:1 payout
            break;
          case "over":
            isWinner = roll >= 75;
            multiplier = 4; // 3:1 payout
            break;
          case "under":
            isWinner = roll <= 25;
            multiplier = 4; // 3:1 payout
            break;
          case "number":
            isWinner = roll === bet.specificNumber;
            multiplier = 100; // 99:1 payout
            break;
        }

        const playerWallet = await getWallet(bet.playerId);
        const betAmount = BigInt(bet.amount);

        if (isWinner) {
          const winnings = betAmount * BigInt(multiplier);
          playerWallet[bet.currency] =
            BigInt(playerWallet[bet.currency]) + winnings;
          await updateWallet(bet.playerId, playerWallet);

          // Update player stats
          await updatePlayerStats(bet.playerId, {
            gamesWon: 1,
            [`${bet.currency}Won`]: winnings - betAmount,
          });
        } else {
          // Update player stats for loss
          await updatePlayerStats(bet.playerId, {
            gamesLost: 1,
            [`${bet.currency}Lost`]: betAmount,
          });
        }

        // Update wagered stats
        await updatePlayerStats(bet.playerId, {
          [`${bet.currency}Wagered`]: betAmount,
        });
      } catch (betError) {
        logger.error(
          "DiceManager",
          `Error processing bet for player ${bet.playerId}`,
          betError
        );
      }
    }

    // Store the bets for return
    const bets = [...game.bets];

    // Remove from memory
    activeDiceGames.delete(hostId);

    // Save to file
    saveDiceTables();

    // Remove from database if available
    try {
      if (mongoose.connection.readyState === 1) {
        await DiceGame.deleteOne({ hostId, isActive: true });
      }
    } catch (dbError) {
      logger.error(
        "DiceManager",
        "Failed to delete dice game from database",
        dbError
      );
      // Continue with in-memory version
    }

    return { success: true, bets };
  } catch (error) {
    logger.error("DiceManager", "Error completing dice game", error);
    return {
      success: false,
      message: "An error occurred while processing the roll result.",
    };
  }
}

/**
 * Get roll history for a host
 * @param {string} hostId - The host's Discord ID
 * @param {number} limit - Maximum number of rolls to return
 * @returns {Promise<Array>} Array of roll objects
 */
async function getHostRollHistory(hostId, limit = 15) {
  try {
    // Check if roll history file exists
    const rollHistoryPath = path.join(__dirname, "/container/data/rollHistory.json");

    if (!fs.existsSync(rollHistoryPath)) {
      return [];
    }

    // Read roll history file
    const data = JSON.parse(fs.readFileSync(rollHistoryPath, "utf8"));
    const hostRolls = data[hostId] || [];

    return hostRolls.slice(0, limit).map((roll) => ({
      hostId,
      result: roll.result,
      timestamp: new Date(roll.timestamp),
    }));
  } catch (error) {
    logger.error("DiceManager", "Error getting host roll history", error);
    return [];
  }
}

/**
 * Add a roll to the host's history
 * @param {string} hostId - The host's Discord ID
 * @param {number} result - The roll result
 * @returns {Promise<boolean>} Success status
 */
async function addRollToHistory(hostId, result) {
  try {
    // Ensure data directory exists
    const dataDir = path.join(__dirname, "/container/data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const rollHistoryPath = path.join(dataDir, "rollHistory.json");

    // Read existing data or create new
    let data = {};
    if (fs.existsSync(rollHistoryPath)) {
      data = JSON.parse(fs.readFileSync(rollHistoryPath, "utf8"));
    }

    // Initialize host's roll history if it doesn't exist
    if (!data[hostId]) {
      data[hostId] = [];
    }

    // Add new roll to the beginning of the array
    data[hostId].unshift({
      result,
      timestamp: new Date().toISOString(),
    });

    // Keep only the last 100 rolls
    if (data[hostId].length > 100) {
      data[hostId] = data[hostId].slice(0, 100);
    }

    // Save to file
    fs.writeFileSync(rollHistoryPath, JSON.stringify(data, null, 2));

    return true;
  } catch (error) {
    logger.error("DiceManager", "Error adding roll to history", error);
    return false;
  }
}

module.exports = {
  loadActiveDiceGames,
  saveActiveDiceGames,
  createDiceGame,
  rollDice,
  getDiceGame,
  getUserDiceGames,
  getDiceGameStats,
  // Dice table functions
  startDiceGame,
  toggleDiceBetting,
  cancelDiceGame,
  getActiveDiceGame,
  placeBet,
  getWinnersFromDiceGame,
  completeDiceGame,
  getHostRollHistory,
  addRollToHistory,
};
