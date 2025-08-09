// utils/DiceDuelManager.js
// Manages dice duels between players

const { v4: uuidv4 } = require("uuid");
const { getWallet, updateWallet } = require("./WalletManager");
const { updateStats } = require("./StatsManager");
const { formatAmount, EMOJIS } = require("./embedcreator");

// Store active dice duels in memory
const activeDiceDuels = new Map();

/**
 * Create a new dice duel
 * @param {string} challengerId - The challenger's Discord ID
 * @param {string} opponentId - The opponent's Discord ID
 * @param {string} amount - The amount to bet
 * @param {string} currency - The currency to bet (osrs or rs3)
 * @returns {Object} Result object with success status
 */
async function createDiceDuel(challengerId, opponentId, amount, currency) {
  // Validate inputs
  if (!challengerId || !opponentId) {
    return {
      success: false,
      message: "Both challenger and opponent IDs are required.",
    };
  }

  if (challengerId === opponentId) {
    return { success: false, message: "You cannot duel yourself." };
  }

  // Check if either player is already in a duel
  for (const [_, duel] of activeDiceDuels) {
    if (
      !duel.isComplete &&
      (duel.challengerId === challengerId || duel.opponentId === challengerId)
    ) {
      return { success: false, message: "You are already in an active duel." };
    }

    if (
      !duel.isComplete &&
      (duel.challengerId === opponentId || duel.opponentId === opponentId)
    ) {
      return {
        success: false,
        message: "Your opponent is already in an active duel.",
      };
    }
  }

  // Validate amount - FIX: Don't use isNaN with BigInt
  try {
    // If amount is already a BigInt, this is fine
    // If it's a string, convert it to BigInt
    const amountBigInt = typeof amount === "bigint" ? amount : BigInt(amount);

    // Check if amount is positive
    if (amountBigInt <= 0n) {
      return { success: false, message: "Amount must be greater than 0." };
    }
  } catch (error) {
    return { success: false, message: "Invalid amount." };
  }

  // Validate currency
  if (currency !== "osrs" && currency !== "rs3") {
    return {
      success: false,
      message: "Invalid currency. Must be 'osrs' or 'rs3'.",
    };
  }

  // Check if challenger has enough funds
  const challengerWallet = await getWallet(challengerId);
  const walletBalance = BigInt(challengerWallet[currency] || 0);
  const amountBigInt = typeof amount === "bigint" ? amount : BigInt(amount);

  if (!challengerWallet || walletBalance < amountBigInt) {
    return {
      success: false,
      message: "You don't have enough funds for this duel.",
    };
  }

  // Deduct amount from challenger's wallet
  challengerWallet[currency] = (walletBalance - amountBigInt).toString();
  await updateWallet(challengerId, challengerWallet);

  // Create duel
  const duelId = uuidv4();
  const duel = {
    id: duelId,
    challengerId,
    opponentId,
    amount: amount.toString(), // Store as string to avoid BigInt serialization issues
    currency,
    createdAt: new Date(),
    isAccepted: false,
    isComplete: false,
    challengerRolled: false,
    opponentRolled: false,
    challengerRoll: 0,
    opponentRoll: 0,
    messageId: null,
  };

  activeDiceDuels.set(duelId, duel);

  return { success: true, duel };
}

/**
 * Get an active dice duel by ID
 * @param {string} duelId - The duel ID
 * @returns {Object|null} The duel object or null if not found
 */
function getActiveDuel(duelId) {
  return activeDiceDuels.get(duelId) || null;
}

/**
 * Get an active dice duel by player ID
 * @param {string} playerId - The player's Discord ID
 * @returns {Object|null} The duel object or null if not found
 */
function getActiveDuelByPlayer(playerId) {
  for (const [_, duel] of activeDiceDuels) {
    if (
      !duel.isComplete &&
      (duel.challengerId === playerId || duel.opponentId === playerId)
    ) {
      return duel;
    }
  }

  return null;
}

/**
 * Accept a dice duel
 * @param {string} duelId - The duel ID
 * @param {string} playerId - The player's Discord ID
 * @returns {Object} Result object with success status
 */
async function acceptDiceDuel(duelId, playerId) {
  const duel = activeDiceDuels.get(duelId);
  if (!duel) {
    return { success: false, message: "Duel not found." };
  }

  if (duel.isComplete) {
    return { success: false, message: "This duel is already complete." };
  }

  if (duel.isAccepted) {
    return { success: false, message: "This duel has already been accepted." };
  }

  if (duel.opponentId !== playerId) {
    return {
      success: false,
      message: "You are not the opponent for this duel.",
    };
  }

  // Check if opponent has enough funds
  const opponentWallet = await getWallet(playerId);
  const walletBalance = BigInt(opponentWallet[duel.currency] || 0);
  const amountBigInt = BigInt(duel.amount);

  if (!opponentWallet || walletBalance < amountBigInt) {
    return {
      success: false,
      message: "You don't have enough funds to accept this duel.",
    };
  }

  // Deduct amount from opponent's wallet
  opponentWallet[duel.currency] = (walletBalance - amountBigInt).toString();
  await updateWallet(playerId, opponentWallet);

  // Mark as accepted
  duel.isAccepted = true;
  duel.acceptedAt = new Date();

  return { success: true, duel };
}

/**
 * Record a dice roll for a player
 * @param {string} playerId - The player's Discord ID
 * @param {number} roll - The roll value (1-100)
 * @returns {Object} Result object with success status
 */
async function recordDiceRoll(playerId, roll) {
  // Find the duel
  let duel = null;
  let duelId = null;

  for (const [id, d] of activeDiceDuels) {
    if (
      !d.isComplete &&
      (d.challengerId === playerId || d.opponentId === playerId)
    ) {
      duel = d;
      duelId = id;
      break;
    }
  }

  if (!duel) {
    return { success: false, message: "You are not in an active duel." };
  }

  if (!duel.isAccepted) {
    return { success: false, message: "This duel has not been accepted yet." };
  }

  // Validate roll
  if (typeof roll !== "number" || roll < 1 || roll > 100) {
    return {
      success: false,
      message: "Invalid roll. Must be between 1 and 100.",
    };
  }

  // Record roll
  if (duel.challengerId === playerId) {
    if (duel.challengerRolled) {
      return { success: false, message: "You have already rolled." };
    }

    duel.challengerRolled = true;
    duel.challengerRoll = roll;
  } else {
    if (duel.opponentRolled) {
      return { success: false, message: "You have already rolled." };
    }

    duel.opponentRolled = true;
    duel.opponentRoll = roll;
  }

  // If both players have rolled, complete the duel
  if (duel.challengerRolled && duel.opponentRolled) {
    await completeDiceDuel(duel.id);
  }

  return {
    success: true,
    duel,
    bothRolled: duel.challengerRolled && duel.opponentRolled,
  };
}

/**
 * Complete a dice duel and process payouts
 * @param {string} duelId - The duel ID
 * @returns {Object} Result object with success status
 */
async function completeDiceDuel(duelId) {
  const duel = activeDiceDuels.get(duelId);
  if (!duel) {
    return { success: false, message: "Duel not found." };
  }

  if (!duel.isAccepted) {
    return { success: false, message: "This duel has not been accepted yet." };
  }

  if (!duel.challengerRolled || !duel.opponentRolled) {
    return { success: false, message: "Both players must roll first." };
  }

  if (duel.isComplete) {
    return { success: false, message: "This duel is already complete." };
  }

  // Determine winner
  let winnerId;
  let loserId;

  if (duel.challengerRoll > duel.opponentRoll) {
    winnerId = duel.challengerId;
    loserId = duel.opponentId;
  } else if (duel.opponentRoll > duel.challengerRoll) {
    winnerId = duel.opponentId;
    loserId = duel.challengerId;
  } else {
    // It's a tie, refund both players
    try {
      const challengerWallet = await getWallet(duel.challengerId);
      const opponentWallet = await getWallet(duel.opponentId);
      const amountBigInt = BigInt(duel.amount);

      challengerWallet[duel.currency] = (
        BigInt(challengerWallet[duel.currency] || 0) + amountBigInt
      ).toString();
      opponentWallet[duel.currency] = (
        BigInt(opponentWallet[duel.currency] || 0) + amountBigInt
      ).toString();

      await updateWallet(duel.challengerId, challengerWallet);
      await updateWallet(duel.opponentId, opponentWallet);
    } catch (error) {
      console.error("Error refunding tie:", error);
      return { success: false, message: "Error processing tie refund." };
    }

    // Mark as complete
    duel.isComplete = true;
    duel.completedAt = new Date();
    duel.isTie = true;

    // Remove after a delay
    setTimeout(() => {
      activeDiceDuels.delete(duelId);
    }, 60000); // Remove after 1 minute

    return { success: true, isTie: true };
  }

  // Process payout - FIXED: Only give money to the winner, don't deduct from loser
  try {
    const winnerWallet = await getWallet(winnerId);
    const amountBigInt = BigInt(duel.amount);

    // Winner gets 2x their bet (their original bet + opponent's bet)
    winnerWallet[duel.currency] = (
      BigInt(winnerWallet[duel.currency] || 0) +
      amountBigInt * 2n
    ).toString();
    await updateWallet(winnerId, winnerWallet);

    // Update player stats
    if (typeof updateStats === "function") {
      try {
        await updateStats(winnerId, "win", "dd", {
          amount: amountBigInt.toString(),
          currency: duel.currency,
        });

        await updateStats(loserId, "loss", "dd", {
          amount: amountBigInt.toString(),
          currency: duel.currency,
        });
      } catch (statsError) {
        console.error("Error updating stats:", statsError);
        // Continue even if stats update fails
      }
    }
  } catch (error) {
    console.error("Error processing payout:", error);
    return { success: false, message: "Error processing payout." };
  }

  // Mark as complete
  duel.isComplete = true;
  duel.completedAt = new Date();
  duel.winnerId = winnerId;

  // Remove after a delay
  setTimeout(() => {
    activeDiceDuels.delete(duelId);
  }, 60000); // Remove after 1 minute

  return { success: true, winnerId };
}

/**
 * Cancel a dice duel and refund both players
 * @param {string} playerId - The player's Discord ID
 * @returns {Object} Result object with success status
 */
async function cancelDiceDuel(playerId) {
  // Find the duel
  let duel = null;
  let duelId = null;

  for (const [id, d] of activeDiceDuels) {
    if (
      !d.isComplete &&
      (d.challengerId === playerId || d.opponentId === playerId)
    ) {
      duel = d;
      duelId = id;
      break;
    }
  }

  if (!duel) {
    return { success: false, message: "You are not in an active duel." };
  }

  // Only the challenger can cancel before acceptance
  if (!duel.isAccepted && duel.challengerId !== playerId) {
    return {
      success: false,
      message: "Only the challenger can cancel the duel before it's accepted.",
    };
  }

  // After acceptance, both players must agree to cancel
  if (duel.isAccepted) {
    // For now, allow either player to cancel
    // In a real implementation, you might want to require both players to agree
  }

  // Refund players
  try {
    const amountBigInt = BigInt(duel.amount);

    // Refund challenger
    const challengerWallet = await getWallet(duel.challengerId);
    challengerWallet[duel.currency] = (
      BigInt(challengerWallet[duel.currency] || 0) + amountBigInt
    ).toString();
    await updateWallet(duel.challengerId, challengerWallet);

    // Refund opponent if they accepted
    if (duel.isAccepted) {
      const opponentWallet = await getWallet(duel.opponentId);
      opponentWallet[duel.currency] = (
        BigInt(opponentWallet[duel.currency] || 0) + amountBigInt
      ).toString();
      await updateWallet(duel.opponentId, opponentWallet);
    }
  } catch (error) {
    console.error("Error refunding duel:", error);
    return { success: false, message: "Error processing refund." };
  }

  // Mark as complete and cancelled
  duel.isComplete = true;
  duel.isCancelled = true;
  duel.cancelledAt = new Date();
  duel.cancelledBy = playerId;

  // Remove after a delay
  setTimeout(() => {
    activeDiceDuels.delete(duelId);
  }, 60000); // Remove after 1 minute

  return { success: true };
}

/**
 * Get the winner from a dice duel
 * @param {string} duelId - The duel ID
 * @returns {Object} Result object with success status
 */
function getWinnerFromDiceDuel(duelId) {
  const duel = activeDiceDuels.get(duelId);
  if (!duel) {
    return { success: false, message: "Duel not found." };
  }

  if (!duel.isComplete) {
    return { success: false, message: "This duel is not complete yet." };
  }

  if (duel.isTie) {
    return { success: true, isTie: true };
  }

  return { success: true, winnerId: duel.winnerId };
}

/**
 * Get all active duels
 * @returns {Array} Array of active duels
 */
function getActiveDuels() {
  const duels = [];
  for (const [_, duel] of activeDiceDuels) {
    if (!duel.isComplete) {
      duels.push(duel);
    }
  }
  return duels;
}

/**
 * Load active dice duels from storage
 * @returns {void}
 */
function loadActiveDiceDuels() {
  // In a real implementation, you would load from a database
  // For now, just initialize the map
  activeDiceDuels.clear();
}

module.exports = {
  createDiceDuel,
  getActiveDuel,
  getActiveDuels,
  getActiveDuelByPlayer,
  acceptDiceDuel,
  recordDiceRoll,
  completeDiceDuel,
  cancelDiceDuel,
  getWinnerFromDiceDuel,
  loadActiveDiceDuels, // Make sure this is exported
  // Export for testing
  activeDiceDuels,
};
