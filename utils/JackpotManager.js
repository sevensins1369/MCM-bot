// utils/JackpotManager.js
const { logger } = require("../enhanced-logger");
const {
  ValidationError,
  DatabaseError,
  safeDbOperation,
} = require("../error-handler");
const { updateWallet, getWallet } = require("./WalletManager");
const { formatAmount, EMOJIS } = require("./embedcreator");
const { randomUUID } = require("crypto");
const fs = require("fs").promises;
const path = require("path");
const { isUsingMongoDB } = require("./database");

// File path for storing jackpot data when MongoDB is unavailable
const JACKPOT_FILE_PATH = path.join(__dirname, "/container/data/jackpots.json");

// Cache for active jackpots
let activeJackpots = new Map();

// Scheduled timers for jackpot drawings
const jackpotTimers = new Map();

/**
 * Initialize the JackpotManager
 */
async function initializeJackpotManager() {
  try {
    logger.info("JackpotManager", "Initializing JackpotManager");
    await loadActiveJackpots();
    scheduleAllJackpotDrawings();
    logger.info("JackpotManager", "JackpotManager initialized successfully");
  } catch (error) {
    logger.error(
      "JackpotManager",
      "Failed to initialize JackpotManager",
      error
    );
  }
}

/**
 * Load active jackpots from database or file
 */
async function loadActiveJackpots() {
  try {
    // Try to load from MongoDB first
    if (isUsingMongoDB()) {
      const Jackpot = require("../models/Jackpot");

      if (Jackpot) {
        const jackpots = await Jackpot.find({
          status: { $in: ["active", "drawing"] },
        });

        jackpots.forEach((jackpot) => {
          activeJackpots.set(
            jackpot.gameId,
            jackpot.toObject ? jackpot.toObject() : jackpot
          );
        });

        logger.info(
          "JackpotManager",
          `Loaded ${activeJackpots.size} active jackpots from database`
        );
      } else {
        // Fallback to file-based storage
        await loadJackpotsFromFile();
      }
    } else {
      // Use file-based storage
      await loadJackpotsFromFile();
    }
  } catch (error) {
    logger.error("JackpotManager", "Failed to load active jackpots", error);
    // Try to load from file as a fallback
    await loadJackpotsFromFile();
  }
}

/**
 * Load jackpots from file
 */
async function loadJackpotsFromFile() {
  try {
    // Check if file exists
    try {
      await fs.access(JACKPOT_FILE_PATH);
    } catch (error) {
      // Create empty file if it doesn't exist
      await fs.writeFile(JACKPOT_FILE_PATH, JSON.stringify({}));
      logger.info(
        "JackpotManager",
        `Created empty jackpots file at ${JACKPOT_FILE_PATH}`
      );
      return;
    }

    // Read file
    const data = await fs.readFile(JACKPOT_FILE_PATH, "utf8");
    const jackpots = JSON.parse(data);

    // Load active jackpots
    Object.values(jackpots).forEach((jackpot) => {
      if (jackpot.status === "active" || jackpot.status === "drawing") {
        activeJackpots.set(jackpot.gameId, jackpot);
      }
    });

    logger.info(
      "JackpotManager",
      `Loaded ${activeJackpots.size} active jackpots from file`
    );
  } catch (error) {
    logger.error("JackpotManager", "Failed to load jackpots from file", error);
  }
}

/**
 * Save a jackpot to database or file
 * @param {Object} jackpot - Jackpot object to save
 */
async function saveJackpot(jackpot) {
  try {
    // Update in-memory cache
    activeJackpots.set(jackpot.gameId, jackpot);

    // Save to database if available
    if (isUsingMongoDB()) {
      const Jackpot = require("../models/Jackpot");

      if (Jackpot) {
        await safeDbOperation(async () => {
          await Jackpot.findOneAndUpdate({ gameId: jackpot.gameId }, jackpot, {
            upsert: true,
            new: true,
          });
        });

        logger.debug(
          "JackpotManager",
          `Saved jackpot ${jackpot.gameId} to database`
        );
      } else {
        // Fallback to file-based storage
        await saveJackpotToFile(jackpot);
      }
    } else {
      // Use file-based storage
      await saveJackpotToFile(jackpot);
    }
  } catch (error) {
    logger.error(
      "JackpotManager",
      `Failed to save jackpot ${jackpot.gameId}`,
      error
    );
    // Try to save to file as a fallback
    await saveJackpotToFile(jackpot);
  }
}

/**
 * Save a jackpot to file
 * @param {Object} jackpot - Jackpot object to save
 */
async function saveJackpotToFile(jackpot) {
  try {
    // Read existing jackpots
    let jackpots = {};
    try {
      const data = await fs.readFile(JACKPOT_FILE_PATH, "utf8");
      jackpots = JSON.parse(data);
    } catch (error) {
      // Ignore if file doesn't exist or is invalid
    }

    // Update jackpot
    jackpots[jackpot.gameId] = jackpot;

    // Write back to file
    await fs.writeFile(JACKPOT_FILE_PATH, JSON.stringify(jackpots, null, 2));

    logger.debug("JackpotManager", `Saved jackpot ${jackpot.gameId} to file`);
  } catch (error) {
    logger.error(
      "JackpotManager",
      `Failed to save jackpot ${jackpot.gameId} to file`,
      error
    );
  }
}

/**
 * Schedule all jackpot drawings
 */
function scheduleAllJackpotDrawings() {
  // Clear existing timers
  for (const [gameId, timer] of jackpotTimers.entries()) {
    clearTimeout(timer);
  }
  jackpotTimers.clear();

  // Schedule new timers
  for (const [gameId, jackpot] of activeJackpots.entries()) {
    scheduleJackpotDrawing(jackpot);
  }
}

/**
 * Schedule a jackpot drawing
 * @param {Object} jackpot - Jackpot object
 */
function scheduleJackpotDrawing(jackpot) {
  // Clear existing timer if any
  if (jackpotTimers.has(jackpot.gameId)) {
    clearTimeout(jackpotTimers.get(jackpot.gameId));
    jackpotTimers.delete(jackpot.gameId);
  }

  // Calculate time until draw
  const drawTime = new Date(jackpot.drawTime).getTime();
  const now = Date.now();
  const timeUntilDraw = drawTime - now;

  // Schedule drawing
  if (timeUntilDraw > 0) {
    const timer = setTimeout(() => drawJackpot(jackpot.gameId), timeUntilDraw);
    jackpotTimers.set(jackpot.gameId, timer);

    logger.info(
      "JackpotManager",
      `Scheduled jackpot ${jackpot.gameId} drawing for ${new Date(
        drawTime
      ).toISOString()}`
    );
  } else {
    // If draw time is in the past, draw immediately
    logger.warn(
      "JackpotManager",
      `Jackpot ${jackpot.gameId} draw time is in the past, drawing immediately`
    );
    drawJackpot(jackpot.gameId);
  }
}

/**
 * Create a new jackpot game
 * @param {Object} options - Jackpot options
 * @param {string} options.currency - Currency for the jackpot (osrs/rs3)
 * @param {string} options.minEntryAmount - Minimum entry amount
 * @param {Date} options.drawTime - Time to draw the winner
 * @param {string} options.createdBy - User ID of creator
 * @param {string} options.channelId - Channel ID for announcements
 * @param {string} options.serverId - Server ID
 * @returns {Object} - Created jackpot object
 */
async function createJackpot(options) {
  // Validate options
  if (!options.currency || !["osrs", "rs3"].includes(options.currency)) {
    throw new ValidationError('Invalid currency. Must be "osrs" or "rs3".');
  }

  if (!options.minEntryAmount || isNaN(BigInt(options.minEntryAmount))) {
    throw new ValidationError("Invalid minimum entry amount.");
  }

  if (!options.drawTime || new Date(options.drawTime) <= new Date()) {
    throw new ValidationError("Draw time must be in the future.");
  }

  if (!options.createdBy) {
    throw new ValidationError("Creator ID is required.");
  }

  // Create new jackpot
  const gameId = randomUUID();
  const jackpot = {
    gameId,
    status: "active",
    startTime: new Date(),
    endTime: null,
    drawTime: new Date(options.drawTime),
    currency: options.currency,
    minEntryAmount: options.minEntryAmount,
    totalPot: "0",
    entries: [],
    winner: {
      userId: null,
      username: null,
      amount: null,
      winningTicket: null,
      totalTickets: null,
    },
    messageId: null,
    channelId: options.channelId || null,
    serverId: options.serverId || null,
    createdBy: options.createdBy,
  };

  // Save to database/file
  await saveJackpot(jackpot);

  // Schedule drawing
  scheduleJackpotDrawing(jackpot);

  logger.info("JackpotManager", `Created new jackpot ${gameId}`, {
    currency: options.currency,
    minEntryAmount: options.minEntryAmount,
    drawTime: options.drawTime,
  });

  return jackpot;
}

/**
 * Enter a jackpot game
 * @param {string} gameId - Jackpot game ID
 * @param {string} userId - User ID
 * @param {string} username - Username
 * @param {string} amount - Entry amount
 * @returns {Object} - Updated jackpot object
 */
async function enterJackpot(gameId, userId, username, amount) {
  // Get jackpot
  const jackpot = activeJackpots.get(gameId);
  if (!jackpot) {
    throw new ValidationError("Jackpot game not found.");
  }

  // Check if jackpot is active
  if (jackpot.status !== "active") {
    throw new ValidationError("This jackpot is no longer accepting entries.");
  }

  // Validate amount
  if (!amount || isNaN(BigInt(amount))) {
    throw new ValidationError("Invalid entry amount.");
  }

  // Check minimum entry amount
  if (BigInt(amount) < BigInt(jackpot.minEntryAmount)) {
    throw new ValidationError(
      `Minimum entry amount is ${formatAmount(
        jackpot.minEntryAmount
      )} ${jackpot.currency.toUpperCase()}.`
    );
  }

  // Get user wallet
  const wallet = await getWallet(userId);
  if (!wallet || BigInt(wallet[jackpot.currency]) < BigInt(amount)) {
    throw new ValidationError("Insufficient funds.");
  }

  // Deduct amount from wallet
  wallet[jackpot.currency] = (
    BigInt(wallet[jackpot.currency]) - BigInt(amount)
  ).toString();
  await updateWallet(userId, wallet);

  // Calculate tickets (1 ticket per 1M)
  const tickets = Math.max(
    1,
    Math.floor(Number(BigInt(amount) / BigInt(1000000)))
  );

  // Add entry
  const entry = {
    userId,
    username,
    amount,
    entryTime: new Date(),
    tickets,
  };

  jackpot.entries.push(entry);

  // Update total pot
  jackpot.totalPot = (BigInt(jackpot.totalPot) + BigInt(amount)).toString();

  // Save updated jackpot
  await saveJackpot(jackpot);

  logger.info("JackpotManager", `User ${userId} entered jackpot ${gameId}`, {
    amount,
    tickets,
    totalPot: jackpot.totalPot,
  });

  return jackpot;
}

/**
 * Draw a jackpot winner
 * @param {string} gameId - Jackpot game ID
 * @returns {Object} - Updated jackpot object
 */
async function drawJackpot(gameId) {
  // Get jackpot
  const jackpot = activeJackpots.get(gameId);
  if (!jackpot) {
    logger.error("JackpotManager", `Jackpot ${gameId} not found for drawing`);
    return null;
  }

  // Update status to drawing
  jackpot.status = "drawing";
  await saveJackpot(jackpot);

  try {
    // Check if there are entries
    if (jackpot.entries.length === 0) {
      logger.info(
        "JackpotManager",
        `No entries for jackpot ${gameId}, cancelling`
      );
      jackpot.status = "cancelled";
      jackpot.endTime = new Date();
      await saveJackpot(jackpot);
      return jackpot;
    }

    // Calculate total tickets
    let totalTickets = 0;
    for (const entry of jackpot.entries) {
      totalTickets += entry.tickets;
    }

    // Generate random winning ticket
    const winningTicket = Math.floor(Math.random() * totalTickets) + 1;

    // Find winner
    let ticketCounter = 0;
    let winner = null;

    for (const entry of jackpot.entries) {
      ticketCounter += entry.tickets;
      if (ticketCounter >= winningTicket) {
        winner = entry;
        break;
      }
    }

    if (!winner) {
      throw new Error(`Failed to find winner for jackpot ${gameId}`);
    }

    // Update jackpot with winner
    jackpot.winner = {
      userId: winner.userId,
      username: winner.username,
      amount: jackpot.totalPot,
      winningTicket,
      totalTickets,
    };

    jackpot.status = "completed";
    jackpot.endTime = new Date();

    // Save updated jackpot
    await saveJackpot(jackpot);

    // Add winnings to winner's wallet
    const winnerWallet = await getWallet(winner.userId);
    winnerWallet[jackpot.currency] = (
      BigInt(winnerWallet[jackpot.currency]) + BigInt(jackpot.totalPot)
    ).toString();
    await updateWallet(winner.userId, winnerWallet);

    logger.info("JackpotManager", `Drew winner for jackpot ${gameId}`, {
      winner: winner.userId,
      amount: jackpot.totalPot,
      winningTicket,
      totalTickets,
    });

    // Remove from active jackpots
    activeJackpots.delete(gameId);

    // Clear timer if it exists
    if (jackpotTimers.has(gameId)) {
      clearTimeout(jackpotTimers.get(gameId));
      jackpotTimers.delete(gameId);
    }

    // Return updated jackpot
    return jackpot;
  } catch (error) {
    logger.error("JackpotManager", `Error drawing jackpot ${gameId}`, error);

    // Revert to active status if there was an error
    jackpot.status = "active";
    await saveJackpot(jackpot);

    // Reschedule drawing for 1 minute later
    const newDrawTime = new Date(Date.now() + 60000);
    jackpot.drawTime = newDrawTime;
    await saveJackpot(jackpot);
    scheduleJackpotDrawing(jackpot);

    throw new DatabaseError(
      "Failed to draw jackpot winner. Rescheduled for 1 minute later.",
      error
    );
  }
}

/**
 * Get all active jackpots
 * @returns {Array} - Array of active jackpots
 */
function getActiveJackpots() {
  return Array.from(activeJackpots.values()).filter(
    (j) => j.status === "active"
  );
}

/**
 * Get a jackpot by ID
 * @param {string} gameId - Jackpot game ID
 * @returns {Object} - Jackpot object
 */
function getJackpot(gameId) {
  return activeJackpots.get(gameId);
}

/**
 * Cancel a jackpot
 * @param {string} gameId - Jackpot game ID
 * @param {string} cancelledBy - User ID who cancelled
 * @returns {Object} - Updated jackpot object
 */
async function cancelJackpot(gameId, cancelledBy) {
  // Get jackpot
  const jackpot = activeJackpots.get(gameId);
  if (!jackpot) {
    throw new ValidationError("Jackpot game not found.");
  }

  // Check if jackpot is active
  if (jackpot.status !== "active") {
    throw new ValidationError("This jackpot cannot be cancelled.");
  }

  // Check if user is authorized to cancel
  if (cancelledBy !== jackpot.createdBy) {
    throw new ValidationError("Only the creator can cancel this jackpot.");
  }

  // Refund all entries
  for (const entry of jackpot.entries) {
    try {
      const wallet = await getWallet(entry.userId);
      wallet[jackpot.currency] = (
        BigInt(wallet[jackpot.currency]) + BigInt(entry.amount)
      ).toString();
      await updateWallet(entry.userId, wallet);

      logger.info(
        "JackpotManager",
        `Refunded ${entry.amount} ${jackpot.currency} to ${entry.userId} for cancelled jackpot ${gameId}`
      );
    } catch (error) {
      logger.error(
        "JackpotManager",
        `Failed to refund ${entry.userId} for cancelled jackpot ${gameId}`,
        error
      );
    }
  }

  // Update jackpot
  jackpot.status = "cancelled";
  jackpot.endTime = new Date();
  jackpot.cancelledBy = cancelledBy;

  // Save updated jackpot
  await saveJackpot(jackpot);

  // Remove from active jackpots
  activeJackpots.delete(gameId);

  // Clear timer if it exists
  if (jackpotTimers.has(gameId)) {
    clearTimeout(jackpotTimers.get(gameId));
    jackpotTimers.delete(gameId);
  }

  logger.info(
    "JackpotManager",
    `Cancelled jackpot ${gameId} by ${cancelledBy}`
  );

  return jackpot;
}

/**
 * Update jackpot message ID
 * @param {string} gameId - Jackpot game ID
 * @param {string} messageId - Message ID
 * @returns {Object} - Updated jackpot object
 */
async function updateJackpotMessage(gameId, messageId) {
  // Get jackpot
  const jackpot = activeJackpots.get(gameId);
  if (!jackpot) {
    throw new ValidationError("Jackpot game not found.");
  }

  // Update message ID
  jackpot.messageId = messageId;

  // Save updated jackpot
  await saveJackpot(jackpot);

  return jackpot;
}

/**
 * Get user entries for a jackpot
 * @param {string} gameId - Jackpot game ID
 * @param {string} userId - User ID
 * @returns {Array} - Array of user entries
 */
function getUserEntries(gameId, userId) {
  // Get jackpot
  const jackpot = activeJackpots.get(gameId);
  if (!jackpot) {
    return [];
  }

  // Filter entries by user ID
  return jackpot.entries.filter((entry) => entry.userId === userId);
}

/**
 * Get total tickets for a user in a jackpot
 * @param {string} gameId - Jackpot game ID
 * @param {string} userId - User ID
 * @returns {number} - Total tickets
 */
function getUserTickets(gameId, userId) {
  // Get user entries
  const entries = getUserEntries(gameId, userId);

  // Sum tickets
  return entries.reduce((total, entry) => total + entry.tickets, 0);
}

/**
 * Get user win chance for a jackpot
 * @param {string} gameId - Jackpot game ID
 * @param {string} userId - User ID
 * @returns {number} - Win chance percentage
 */
function getUserWinChance(gameId, userId) {
  // Get jackpot
  const jackpot = activeJackpots.get(gameId);
  if (!jackpot) {
    return 0;
  }

  // Get user tickets
  const userTickets = getUserTickets(gameId, userId);

  // Calculate total tickets
  const totalTickets = jackpot.entries.reduce(
    (total, entry) => total + entry.tickets,
    0
  );

  // Calculate win chance
  if (totalTickets === 0) {
    return 0;
  }

  return (userTickets / totalTickets) * 100;
}

module.exports = {
  initializeJackpotManager,
  loadActiveJackpots,
  createJackpot,
  enterJackpot,
  drawJackpot,
  getActiveJackpots,
  getJackpot,
  cancelJackpot,
  updateJackpotMessage,
  getUserEntries,
  getUserTickets,
  getUserWinChance,
};
