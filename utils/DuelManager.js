// utils/DuelManager.js
const mongoose = require("mongoose");
const Duel = require("../models/duel");
const { updateWallet, getWallet } = require("./WalletManager");
const { updatePlayerStats } = require("./PlayerStatsManager");
const { formatAmount } = require("./embedcreator");

/**
 * Get an active duel for a user, whether they are the host or the opponent.
 * @param {string} userId - The user's Discord ID
 * @returns {Object|null} The duel object or null if not found
 */
async function getDuel(userId) {
  try {
    // Use $or to find a duel where the user is either the host or the opponent
    const duel = await Duel.findOne({
      $or: [{ hostId: userId }, { opponentId: userId }],
      isComplete: false,
    });
    return duel;
  } catch (error) {
    console.error("Error getting duel:", error);
    return { success: false, message: "Database error while fetching duel." };
  }
}

/**
 * Create a new duel for a host
 * @param {string} hostId - The host's Discord ID
 * @param {string} type - The type of duel (e.g., 'whip', 'boxing')
 * @param {string|null} opponentId - The opponent's Discord ID (optional)
 * @returns {Object} The created duel object
 */
async function createDuel(hostId, type, opponentId = null) {
  // Check if host already has an active duel
  const existingDuel = await getDuel(hostId);
  if (existingDuel) {
    return {
      success: false,
      message: "You already have an active duel. Cancel it first.",
    };
  }

  // If opponent is specified, check if they already have an active duel
  if (opponentId) {
    const opponentDuel = await getDuel(opponentId);
    if (opponentDuel) {
      return {
        success: false,
        message:
          "The opponent already has an active duel. They need to cancel it first.",
      };
    }
  }

  // Create a new duel
  const duel = new Duel({
    hostId,
    opponentId,
    type: type.toLowerCase(),
    isOpen: true,
    isComplete: false,
    bets: [],
    createdAt: new Date(),
  });

  await duel.save();

  return { success: true, duel };
}

/**
 * Set the message ID and channel ID for an active duel
 * @param {string} hostId - The host's Discord ID
 * @param {string} messageId - The ID of the message
 * @param {string} channelId - The ID of the channel
 * @returns {Promise<boolean>} Success status
 */
async function setDuelMessage(hostId, messageId, channelId) {
  try {
    const duel = await getDuel(hostId);
    if (!duel) return false;

    duel.messageId = messageId;
    duel.channelId = channelId;
    await duel.save();
    return true;
  } catch (error) {
    console.error("Error setting duel message:", error);
    return false;
  }
}

/**
 * Add a bet to a duel
 * @param {string} hostId - The host's Discord ID
 * @param {Object} bet - The bet object
 * @returns {Object} Result object with success status
 */
async function addBetToDuel(hostId, bet) {
  const duel = await getDuel(hostId);
  if (!duel) {
    return { success: false, message: "No active duel found for this host." };
  }

  if (!duel.isOpen) {
    return { success: false, message: "This duel is not open for betting." };
  }

  // Add the bet
  duel.bets.push(bet);
  await duel.save();

  return { success: true };
}

/**
 * Toggle betting for a duel
 * @param {string} hostId - The host's Discord ID
 * @returns {Object} Result object with success status and new state
 */
async function toggleDuelBetting(hostId) {
  const duel = await Duel.findOne({ hostId, isComplete: false });
  if (!duel) {
    return { success: false, message: "No active duel found." };
  }

  duel.isOpen = !duel.isOpen;
  await duel.save();

  return { success: true, isOpen: duel.isOpen };
}

/**
 * Close bets for a duel
 * @param {string} hostId - The host's Discord ID
 * @returns {Object} The updated duel object
 */
async function closeBets(hostId) {
  const duel = await Duel.findOne({ hostId, isComplete: false });
  if (!duel) return null;

  duel.isOpen = false;
  await duel.save();
  return duel;
}

/**
 * Open bets for a duel
 * @param {string} hostId - The host's Discord ID
 * @returns {Object} The updated duel object
 */
async function openBets(hostId) {
  const duel = await Duel.findOne({ hostId, isComplete: false });
  if (!duel) return null;

  duel.isOpen = true;
  await duel.save();
  return duel;
}

/**
 * Complete a duel and process payouts
 * @param {string} hostId - The host's Discord ID
 * @param {string} winner - The winner (host or opponent)
 * @returns {Object} Result object with success status
 */
async function completeDuel(hostId, winner) {
  const duel = await Duel.findOne({ hostId, isComplete: false });
  if (!duel) {
    return { success: false, message: "No active duel found." };
  }

  // Close betting
  duel.isOpen = false;

  // Mark as complete
  duel.isComplete = true;
  duel.winner = winner;
  duel.completedAt = new Date();

  // Process payouts
  if (duel.bets.length > 0) {
    for (const bet of duel.bets) {
      try {
        const playerWallet = await getWallet(bet.playerId);

        // Check if bet was on the winning side
        if (bet.side === winner) {
          // Winner gets 2x their bet
          playerWallet[bet.currency] += BigInt(bet.amount) * 2n;

          // Update player stats
          await updatePlayerStats(bet.playerId, {
            betsWon: 1,
            [`${bet.currency}Won`]: BigInt(bet.amount),
            [`${bet.currency}Wagered`]: BigInt(bet.amount),
          });
        } else {
          // Update player stats for losers
          await updatePlayerStats(bet.playerId, {
            betsLost: 1,
            [`${bet.currency}Lost`]: BigInt(bet.amount),
            [`${bet.currency}Wagered`]: BigInt(bet.amount),
          });
        }

        await updateWallet(bet.playerId, playerWallet);
      } catch (error) {
        console.error(
          `Error processing payout for bet by ${bet.playerId}:`,
          error
        );
      }
    }
  }

  await duel.save();

  return { success: true };
}

/**
 * End a duel without processing payouts (for loss command)
 * @param {string} hostId - The host's Discord ID
 * @returns {Object} Result object with success status
 */
async function endDuel(hostId) {
  const duel = await Duel.findOne({ hostId, isComplete: false });
  if (!duel) {
    return { success: false, message: "No active duel found." };
  }

  // Mark as complete
  duel.isComplete = true;
  duel.winner = "opponent"; // In a loss, the opponent wins
  duel.completedAt = new Date();
  await duel.save();

  return { success: true };
}

/**
 * Cancel a duel and refund all bets
 * @param {string} hostId - The host's Discord ID
 * @returns {Object} Result object with success status
 */
async function cancelDuel(hostId) {
  const duel = await Duel.findOne({ hostId, isComplete: false });
  if (!duel) {
    return { success: false, message: "No active duel found." };
  }

  // Process refunds
  if (duel.bets.length > 0) {
    for (const bet of duel.bets) {
      try {
        const playerWallet = await getWallet(bet.playerId);
        playerWallet[bet.currency] += BigInt(bet.amount);
        await updateWallet(bet.playerId, playerWallet);
      } catch (error) {
        console.error(`Error refunding bet for ${bet.playerId}:`, error);
      }
    }
  }

  // Delete the duel
  await Duel.deleteOne({ _id: duel._id });

  return { success: true };
}

/**
 * Get all winners and their winnings from a duel
 * @param {string} duelId - The host's Discord ID (which is the duel ID)
 * @param {string} winnerSide - The winning side ('host' or 'opponent')
 * @returns {Array} Array of winner objects with playerId and winnings
 */
async function getWinnersFromDuel(duelId, winnerSide) {
  const duel = await Duel.findOne({ hostId: duelId });
  if (!duel) return [];

  // Filter bets by the winning side
  const winningBets = duel.bets.filter((bet) => bet.side === winnerSide);

  // Group bets by player ID and calculate total winnings
  const winners = [];
  const playerMap = new Map();

  for (const bet of winningBets) {
    const { playerId, amount, currency } = bet;

    if (!playerMap.has(playerId)) {
      playerMap.set(playerId, { osrs: 0n, rs3: 0n });
    }

    const player = playerMap.get(playerId);
    player[currency] += BigInt(amount) * 2n; // Assuming 2x payout
  }

  // Convert map to array of winner objects
  for (const [playerId, winnings] of playerMap.entries()) {
    winners.push({
      playerId,
      osrsWinnings: winnings.osrs,
      rs3Winnings: winnings.rs3,
    });
  }

  return winners;
}

/**
 * Refund a specific player's bet on a duel
 * @param {string} hostId - The host's Discord ID
 * @param {string} playerId - The player's Discord ID
 * @returns {Object} Result object with success status
 */
async function refundBet(hostId, playerId) {
  const duel = await Duel.findOne({ hostId, isComplete: false });
  if (!duel) {
    return { success: false, message: "No active duel found." };
  }

  // Find the player's bets
  const playerBets = duel.bets.filter((bet) => bet.playerId === playerId);
  if (playerBets.length === 0) {
    return { success: false, message: "This player has no bets on your duel." };
  }

  // Process refunds
  for (const bet of playerBets) {
    try {
      const playerWallet = await getWallet(bet.playerId);
      playerWallet[bet.currency] += BigInt(bet.amount);
      await updateWallet(bet.playerId, playerWallet);
    } catch (error) {
      console.error(`Error refunding bet for ${bet.playerId}:`, error);
      return { success: false, message: "Error processing refund." };
    }
  }

  // Remove the player's bets from the duel
  duel.bets = duel.bets.filter((bet) => bet.playerId !== playerId);
  await duel.save();

  return { success: true };
}

module.exports = {
  getDuel,
  createDuel,
  setDuelMessage,
  addBetToDuel,
  toggleDuelBetting,
  closeBets,
  openBets,
  completeDuel,
  endDuel,
  cancelDuel,
  refundBet,
  getWinnersFromDuel,
};
