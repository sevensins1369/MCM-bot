// utils/HotColdManager.js
// Manages Hot/Cold games

const { v4: uuidv4 } = require("uuid");
const { getWallet, updateWallet } = require("./WalletManager");
const { updateStats } = require("./StatsManager");
const { EmbedBuilder } = require("discord.js");
const { formatAmount, EMOJIS } = require("./embedcreator");
const mongoose = require("mongoose");

// Define constants
const HOT_COLORS = ["red", "orange", "yellow", "black"];
const COLD_COLORS = ["blue", "green", "purple", "white"];
const ALL_COLORS = [...HOT_COLORS, ...COLD_COLORS];
const VALID_BET_TYPES = ["hot", "cold", ...ALL_COLORS];

// Store active games in memory
const activeGames = new Map();

// Import the model
const HotColdGame = require("../models/HotColdGame");

/**
 * Create a new Hot/Cold game
 * @param {string} hostId - The host's Discord ID
 * @returns {Object} The created game
 */
async function createGame(hostId) {
  // Check if host already has an active game
  if (activeGames.has(hostId)) {
    throw new Error("You already have an active Hot/Cold game.");
  }

  // Create game object
  const game = {
    id: uuidv4().substring(0, 8),
    hostId,
    bets: [],
    isOpen: true,
    result: null,
    createdAt: new Date(),
  };

  // Store game
  activeGames.set(hostId, game);

  return game;
}

/**
 * Get an active Hot/Cold game by host ID
 * @param {string} hostId - The host's Discord ID
 * @returns {Object|null} The game object or null if not found
 */
function getActiveGame(hostId) {
  return activeGames.get(hostId);
}

/**
 * Place a bet on a Hot/Cold game
 * @param {string} hostId - The host's Discord ID
 * @param {Object} bet - The bet object
 * @returns {void}
 */
async function placeBet(hostId, bet) {
  const game = activeGames.get(hostId);
  if (!game) {
    throw new Error("Game not found.");
  }

  if (!game.isOpen) {
    throw new Error("Betting is closed for this game.");
  }

  // Add bet to game
  game.bets.push(bet);
}

/**
 * Close betting for a Hot/Cold game
 * @param {string} hostId - The host's Discord ID
 * @returns {void}
 */
function closeBetting(hostId) {
  const game = activeGames.get(hostId);
  if (!game) {
    throw new Error("Game not found.");
  }

  game.isOpen = false;
}

/**
 * Reopen betting for a Hot/Cold game
 * @param {string} hostId - The host's Discord ID
 * @returns {void}
 */
function reopenBetting(hostId) {
  const game = activeGames.get(hostId);
  if (!game) {
    throw new Error("Game not found.");
  }

  if (game.result) {
    throw new Error("Cannot reopen betting after result has been set.");
  }

  game.isOpen = true;
}

/**
 * Set the result for a Hot/Cold game
 * @param {string} hostId - The host's Discord ID
 * @param {string} color - The color result
 * @returns {Object} The result object
 */
function setResult(hostId, color) {
  const game = activeGames.get(hostId);
  if (!game) {
    throw new Error("Game not found.");
  }

  if (game.isOpen) {
    throw new Error("You must close betting before setting the result.");
  }

  if (game.result) {
    throw new Error("This game already has a result.");
  }

  // Validate color
  if (!ALL_COLORS.includes(color)) {
    throw new Error(`Invalid color. Valid colors: ${ALL_COLORS.join(", ")}`);
  }

  // Determine if it's hot or cold
  const type = HOT_COLORS.includes(color) ? "hot" : "cold";

  // Set the result
  game.result = { color, type };

  return game.result;
}

/**
 * Process payouts for a Hot/Cold game
 * @param {string} hostId - The host's Discord ID
 * @returns {Object} Results object with winners and losers
 */
async function processPayouts(hostId) {
  const game = activeGames.get(hostId);
  if (!game) {
    throw new Error("Game not found.");
  }

  if (!game.result) {
    throw new Error("You must set the result before processing payouts.");
  }

  const results = {
    winners: [],
    losers: [],
    result: game.result,
  };

  // Calculate total payouts
  let totalPayout = 0n;

  // Process each bet
  for (const bet of game.bets) {
    const betAmount = BigInt(bet.amount);
    let payout = 0n;

    // Check if bet wins
    if (bet.betType === game.result.color) {
      // Exact color match - 5x payout
      payout = betAmount * 5n;
    } else if (bet.betType === game.result.type) {
      // Type match (hot/cold) - 1.85x payout
      payout = (betAmount * 185n) / 100n; // 1.85x
    }

    // Update player's wallet and stats
    if (payout > 0n) {
      try {
        // Get player's wallet
        const playerWallet = await getWallet(bet.playerId);
        const currentBalance = BigInt(playerWallet[bet.currency] || 0);

        // Add payout to wallet
        playerWallet[bet.currency] = (currentBalance + payout).toString();
        await updateWallet(bet.playerId, playerWallet);

        // Update stats - FIX: Create statsUpdate object properly
        try {
          const statsUpdate = {};
          statsUpdate[`${bet.currency}Wagered`] = betAmount;
          statsUpdate[`${bet.currency}Won`] = payout - betAmount;
          statsUpdate.betsWon = 1;

          await updateStats(bet.playerId, statsUpdate);
        } catch (statsError) {
          console.error(
            `Error updating stats for player ${bet.playerId}:`,
            statsError
          );
        }

        // Add to winners list
        results.winners.push({
          playerId: bet.playerId,
          betType: bet.betType,
          amount: bet.amount,
          payout: payout.toString(),
          profit: (payout - betAmount).toString(),
          currency: bet.currency,
        });

        // Add to total payout
        totalPayout += payout;
      } catch (error) {
        console.error(
          `Error processing payout for player ${bet.playerId}:`,
          error
        );
      }
    } else {
      // Update stats for losers - FIX: Create statsUpdate object properly
      try {
        const statsUpdate = {};
        statsUpdate[`${bet.currency}Wagered`] = betAmount;
        statsUpdate[`${bet.currency}Lost`] = betAmount;
        statsUpdate.betsLost = 1;

        await updateStats(bet.playerId, statsUpdate);

        // Add to losers list
        results.losers.push({
          playerId: bet.playerId,
          betType: bet.betType,
          amount: bet.amount,
          currency: bet.currency,
        });
      } catch (error) {
        console.error(
          `Error updating stats for player ${bet.playerId}:`,
          error
        );
      }
    }
  }

  // Save game to history
  try {
    // Create a new HotColdGame document
    const gameHistory = new HotColdGame({
      id: game.id,
      hostId: game.hostId,
      bets: game.bets,
      result: {
        color: game.result.color,
        type: game.result.type,
      },
      createdAt: game.createdAt,
      endedAt: new Date(),
    });

    // Save with error handling
    await gameHistory.save().catch((err) => {
      console.error("Error details:", JSON.stringify(err, null, 2));
      throw err;
    });

    console.log("Game history saved successfully:", gameHistory.id);
  } catch (error) {
    console.error("Error saving game history:", error);
  }

  // Remove game from active games
  activeGames.delete(hostId);

  return results;
}

/**
 * Cancel a Hot/Cold game and refund all bets
 * @param {string} hostId - The host's Discord ID
 * @returns {Object} Results object with refunded bets
 */
async function cancelGame(hostId) {
  const game = activeGames.get(hostId);
  if (!game) {
    throw new Error("Game not found.");
  }

  const refunds = [];

  // Refund all bets
  for (const bet of game.bets) {
    try {
      // Get player's wallet
      const playerWallet = await getWallet(bet.playerId);
      const currentBalance = BigInt(playerWallet[bet.currency] || 0);
      const betAmount = BigInt(bet.amount);

      // Add refund to wallet
      playerWallet[bet.currency] = (currentBalance + betAmount).toString();
      await updateWallet(bet.playerId, playerWallet);

      // Add to refunds list
      refunds.push({
        playerId: bet.playerId,
        amount: bet.amount,
        currency: bet.currency,
      });
    } catch (error) {
      console.error(`Error refunding bet for player ${bet.playerId}:`, error);
    }
  }

  // Remove game from active games
  activeGames.delete(hostId);

  return { refunds };
}

/**
 * Get history of Hot/Cold games for a user
 * @param {string} userId - The user's Discord ID
 * @returns {Array} Array of game history objects
 */
async function getHistory(userId) {
  try {
    // Get games where user was the host
    const games = await HotColdGame.find({ hostId: userId })
      .sort({ endedAt: -1 }) // Sort by end date, newest first
      .lean();

    return games;
  } catch (error) {
    console.error(`Error getting Hot/Cold history for user ${userId}:`, error);
    return [];
  }
}

/**
 * Create an embed for displaying Hot/Cold game results
 * @param {Object} game - The game object
 * @param {Object} results - The results object from processPayouts
 * @param {Object} host - The host user object
 * @returns {EmbedBuilder} The embed
 */
function createResultsEmbed(game, results, host) {
  // Determine embed color based on result
  let embedColor;
  if (game.result.type === "hot") {
    embedColor = 0xff5733; // Hot orange-red
  } else {
    embedColor = 0x3498db; // Cold blue
  }

  // Create embed
  const embed = new EmbedBuilder()
    .setTitle(
      `${EMOJIS.fire || "🔥"} HOT COLD ${EMOJIS.snowflake || "❄️"} Results`
    )
    .setColor(embedColor)
    .setDescription(`${host.toString()}'s Hot/Cold game has ended!`)
    .addFields({
      name: "Result",
      value: `${
        game.result.type === "hot" ? "🔥 HOT" : "❄️ COLD"
      } - ${game.result.color.toUpperCase()}`,
      inline: false,
    })
    .setTimestamp();

  // Add winner count and total payouts
  if (results.winners && results.winners.length > 0) {
    // Group winners by currency
    const winnersByCurrency = {};
    let totalWinners = 0;

    for (const winner of results.winners) {
      if (!winnersByCurrency[winner.currency]) {
        winnersByCurrency[winner.currency] = 0n;
      }
      winnersByCurrency[winner.currency] += BigInt(winner.payout);
      totalWinners++;
    }

    // Create payout summary
    let payoutSummary = "";
    for (const [currency, amount] of Object.entries(winnersByCurrency)) {
      payoutSummary += `${formatAmount(amount)} ${currency.toUpperCase()}\n`;
    }

    embed.addFields(
      { name: "Winners", value: totalWinners.toString(), inline: true },
      { name: "Total Payouts", value: payoutSummary || "None", inline: true }
    );

    // Add detailed winners
    const winnersText = results.winners
      .slice(0, 10) // Limit to 10 winners
      .map(
        (w) =>
          `<@${w.playerId}>: ${formatBetType(w.betType)} - ${formatAmount(
            BigInt(w.profit)
          )} ${w.currency.toUpperCase()}`
      )
      .join("\n");

    if (winnersText) {
      embed.addFields({
        name: `Top Winners${
          results.winners.length > 10
            ? ` (${results.winners.length - 10} more)`
            : ""
        }`,
        value: winnersText,
        inline: false,
      });
    }
  } else {
    embed.addFields(
      { name: "Winners", value: "None", inline: true },
      { name: "Total Payouts", value: "None", inline: true }
    );
  }

  // Add loser count
  if (results.losers && results.losers.length > 0) {
    embed.addFields({
      name: "Losers",
      value: results.losers.length.toString(),
      inline: true,
    });
  }

  return embed;
}

/**
 * Format bet type for display
 * @param {string} betType - The bet type
 * @returns {string} Formatted bet type
 */
function formatBetType(betType) {
  if (betType === "hot") return "🔥 HOT";
  if (betType === "cold") return "❄️ COLD";
  return betType.charAt(0).toUpperCase() + betType.slice(1);
}

module.exports = {
  HOT_COLORS,
  COLD_COLORS,
  ALL_COLORS,
  VALID_BET_TYPES,
  createGame,
  getActiveGame,
  placeBet,
  closeBetting,
  reopenBetting,
  setResult,
  processPayouts,
  cancelGame,
  getHistory,
  createResultsEmbed,
  formatBetType,
};
