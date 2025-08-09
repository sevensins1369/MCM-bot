// utils/FlowerGameManager.js
const mongoose = require("mongoose");
const { getWallet, updateWallet } = require("./WalletManager");
const StatsManager = require("./StatsManager"); // Import the entire module
const UserProfile = require("../models/UserProfile");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { EMOJIS, formatAmount } = require("./embedcreator");
const { isUsingMongoDB } = require("./database");
const fs = require("fs");
const path = require("path");
const FlowerGame = require("../models/FlowerGame");

// Define flower types
const FLOWERS = {
  HOT: ["red", "orange", "yellow"],
  COLD: ["blue", "purple", "pastel"],
  SPECIAL: ["black", "white", "rainbow"],
  ALL: [
    "red",
    "orange",
    "yellow",
    "blue",
    "purple",
    "white",
    "black",
    "rainbow",
    "pastel",
  ],
};

// In-memory cache for active flower games
const activeFlowerGames = new Map();

// File path for storing flower games when MongoDB is not available
const flowerGamesFilePath = path.join(
  __dirname,
  "..",
  "data",
  "flowergames.json"
);

// Initialize the file if it doesn't exist
if (!fs.existsSync(flowerGamesFilePath)) {
  fs.writeFileSync(flowerGamesFilePath, JSON.stringify({}));
}

/**
 * Save flower games to file (used when MongoDB is not available)
 */
function saveFlowerGamesToFile() {
  const games = {};
  for (const [hostId, game] of activeFlowerGames.entries()) {
    games[hostId] = game;
  }
  fs.writeFileSync(flowerGamesFilePath, JSON.stringify(games, null, 2));
}

/**
 * Load flower games from file (used when MongoDB is not available)
 */
function loadFlowerGamesFromFile() {
  try {
    const data = fs.readFileSync(flowerGamesFilePath, "utf8");
    const games = JSON.parse(data);
    for (const [hostId, game] of Object.entries(games)) {
      activeFlowerGames.set(hostId, game);
    }
    console.log(`✅ Loaded ${activeFlowerGames.size} flower games from file.`);
  } catch (error) {
    console.error("❌ Failed to load flower games from file:", error);
  }
}

/**
 * Create a new flower game
 * @param {string} hostId - The host's Discord ID
 * @param {string} gameType - The type of flower game
 * @returns {Object} The created game
 */
async function createFlowerGame(hostId, gameType) {
  if (activeFlowerGames.has(hostId)) {
    throw new Error("You already have an active flower game.");
  }

  const game = {
    hostId,
    gameType,
    bets: [],
    isOpen: true,
    selectedFlowers: [],
    hostHand: [],
    playerHand: [],
    minigameActive: false,
    currentMinigame: null,
    minigameData: {},
    createdAt: new Date(),
  };

  // Store in memory
  activeFlowerGames.set(hostId, game);

  // Store in database or file
  if (isUsingMongoDB()) {
    try {
      await FlowerGame.create(game);
    } catch (error) {
      console.error("Failed to save flower game to database:", error);
      // Continue with in-memory version
    }
  } else {
    saveFlowerGamesToFile();
  }

  return game;
}

/**
 * Get a flower game by host ID
 * @param {string} hostId - The host's Discord ID
 * @returns {Object|null} The flower game or null if not found
 */
function getFlowerGame(hostId) {
  return activeFlowerGames.get(hostId);
}

/**
 * Get all active flower games
 * @returns {Map} Map of active flower games
 */
function getActiveFlowerGames() {
  return activeFlowerGames;
}

/**
 * Add a bet to a flower game
 * @param {string} hostId - The host's Discord ID
 * @param {Object} bet - The bet object
 * @returns {void}
 */
async function addBet(hostId, bet) {
  const game = activeFlowerGames.get(hostId);
  if (!game) {
    throw new Error("This host does not have an active flower game.");
  }

  if (!game.isOpen) {
    throw new Error("Betting is closed for this flower game.");
  }

  // Validate bet type based on game type
  validateBetType(game.gameType, bet.betType);

  // Update in-memory cache
  game.bets.push(bet);

  // Update database or file
  if (isUsingMongoDB()) {
    try {
      await FlowerGame.updateOne({ hostId }, { $push: { bets: bet } });
    } catch (error) {
      console.error("Failed to update flower game in database:", error);
      // Continue with in-memory version
    }
  } else {
    saveFlowerGamesToFile();
  }
}

/**
 * Validate bet type based on game type
 * @param {string} gameType - The type of flower game
 * @param {string} betType - The type of bet
 * @returns {boolean} True if valid, throws error if invalid
 */
function validateBetType(gameType, betType) {
  const betType_lower = betType.toLowerCase();

  if (gameType === "hot_cold") {
    if (!["hot", "cold", "tie"].includes(betType_lower)) {
      throw new Error(
        "Invalid bet type for Hot/Cold game. Valid types: hot, cold, tie"
      );
    }
  } else if (gameType === "pairs") {
    if (!["pair", "two_pair", "three_kind"].includes(betType_lower)) {
      throw new Error(
        "Invalid bet type for Pairs game. Valid types: pair, two_pair, three_kind"
      );
    }
  } else if (gameType === "custom") {
    if (
      !FLOWERS.ALL.includes(betType_lower) &&
      !["hot", "cold"].includes(betType_lower)
    ) {
      throw new Error(
        `Invalid bet type for Custom game. Valid types: ${FLOWERS.ALL.join(
          ", "
        )}, hot, cold`
      );
    }
  } else if (gameType === "flower_poker") {
    if (!["host", "player"].includes(betType_lower)) {
      throw new Error(
        "Invalid bet type for Flower Poker. Valid types: host, player"
      );
    }
  } else if (gameType === "rainbow_mania") {
    if (!["hot", "cold", "rainbow", "wildcard"].includes(betType_lower)) {
      throw new Error(
        "Invalid bet type for Rainbow Mania. Valid types: hot, cold, rainbow, wildcard"
      );
    }
  }

  return true;
}

/**
 * Close betting for a flower game
 * @param {string} hostId - The host's Discord ID
 * @returns {void}
 */
async function closeBetting(hostId) {
  const game = activeFlowerGames.get(hostId);
  if (!game) {
    throw new Error("You do not have an active flower game.");
  }

  // Update in-memory cache
  game.isOpen = false;

  // Update database or file
  if (isUsingMongoDB()) {
    try {
      await FlowerGame.updateOne({ hostId }, { $set: { isOpen: false } });
    } catch (error) {
      console.error("Failed to update flower game in database:", error);
      // Continue with in-memory version
    }
  } else {
    saveFlowerGamesToFile();
  }
}

/**
 * Select flowers for a flower game
 * @param {string} hostId - The host's Discord ID
 * @param {string} flowers - Space-separated list of flowers
 * @param {Object} options - Additional options (hostHand, playerHand)
 * @returns {Array} Array of selected flowers
 */
async function selectFlowers(hostId, flowers, options = {}) {
  const game = activeFlowerGames.get(hostId);
  if (!game) {
    throw new Error("You do not have an active flower game.");
  }

  if (game.isOpen) {
    throw new Error("You must close betting before selecting flowers.");
  }

  // Validate flowers
  const flowerArray = flowers
    .toLowerCase()
    .split(/\s+/)
    .filter((f) => FLOWERS.ALL.includes(f));

  if (flowerArray.length === 0) {
    throw new Error(
      "No valid flowers provided. Valid flowers are: " + FLOWERS.ALL.join(", ")
    );
  }

  // Handle specific game types
  if (game.gameType === "flower_poker") {
    if (options.hostHand && options.playerHand) {
      // Validate hands
      if (options.hostHand.length !== 5 || options.playerHand.length !== 5) {
        throw new Error(
          "Both host and player hands must have exactly 5 flowers each."
        );
      }

      // Update hands
      game.hostHand = options.hostHand;
      game.playerHand = options.playerHand;

      // Update in database if using MongoDB
      if (isUsingMongoDB()) {
        try {
          await FlowerGame.updateOne(
            { hostId },
            {
              $set: {
                hostHand: options.hostHand,
                playerHand: options.playerHand,
              },
            }
          );
        } catch (error) {
          console.error("Failed to update flower game in database:", error);
        }
      }
    } else {
      // If no specific hands provided, split the flowers into two hands
      if (flowerArray.length < 10) {
        throw new Error(
          "For Flower Poker, you need at least 10 flowers (5 for host, 5 for player)."
        );
      }

      game.hostHand = flowerArray.slice(0, 5);
      game.playerHand = flowerArray.slice(5, 10);
    }
  } else if (game.gameType === "rainbow_mania") {
    // For Rainbow Mania, we need exactly 8 flowers
    if (flowerArray.length !== 8) {
      throw new Error("Rainbow Mania requires exactly 8 flowers.");
    }
  }

  // Update in-memory cache
  game.selectedFlowers = flowerArray;

  // Update database or file
  if (isUsingMongoDB()) {
    try {
      const updateData = { selectedFlowers: flowerArray };

      if (game.gameType === "flower_poker") {
        updateData.hostHand = game.hostHand;
        updateData.playerHand = game.playerHand;
      }

      await FlowerGame.updateOne({ hostId }, { $set: updateData });
    } catch (error) {
      console.error("Failed to update flower game in database:", error);
      // Continue with in-memory version
    }
  } else {
    saveFlowerGamesToFile();
  }

  // For Rainbow Mania, check if any minigames are triggered
  if (game.gameType === "rainbow_mania") {
    checkRainbowManiaMinigames(hostId);
  }

  return flowerArray;
}

/**
 * Check if any Rainbow Mania minigames are triggered
 * @param {string} hostId - The host's Discord ID
 * @returns {Object|null} Minigame data if triggered, null otherwise
 */
function checkRainbowManiaMinigames(hostId) {
  const game = activeFlowerGames.get(hostId);
  if (!game || game.gameType !== "rainbow_mania") {
    return null;
  }

  const flowers = game.selectedFlowers;
  const hotCount = flowers.filter((f) => FLOWERS.HOT.includes(f)).length;
  const coldCount = flowers.filter((f) => FLOWERS.COLD.includes(f)).length;
  const rainbowCount = flowers.filter((f) => f === "rainbow").length;
  const blackCount = flowers.filter((f) => f === "black").length;
  const whiteCount = flowers.filter((f) => f === "white").length;

  // Check for minigames
  const minigames = [];

  // HOT minigames
  if (hotCount >= 5)
    minigames.push({ type: "hot_lucky_pick", count: hotCount });
  if (flowers.filter((f) => f === "red").length >= 4)
    minigames.push({ type: "hot_extra_flowers" });

  // COLD minigames
  if (coldCount >= 5)
    minigames.push({ type: "cold_lucky_pick", count: coldCount });
  if (flowers.filter((f) => f === "pastel").length >= 4)
    minigames.push({ type: "cold_extra_flowers" });

  // RAINBOW minigames
  if (rainbowCount >= 3)
    minigames.push({ type: "rainbow_pick", count: rainbowCount });

  // WILDCARD minigames
  const colorCounts = {};
  flowers.forEach((f) => {
    if (f !== "black" && f !== "white") {
      colorCounts[f] = (colorCounts[f] || 0) + 1;
    }
  });

  const hasFourSameColor = Object.values(colorCounts).some(
    (count) => count >= 4
  );
  if (hasFourSameColor) minigames.push({ type: "wildcard_four_same_color" });

  if (blackCount === 1 || whiteCount === 1)
    minigames.push({ type: "wildcard_one_black_white" });
  if (blackCount >= 2 || whiteCount >= 2)
    minigames.push({ type: "wildcard_two_black_white" });

  const uniqueColors = new Set(
    flowers.filter((f) => f !== "black" && f !== "white")
  );
  if (uniqueColors.size === FLOWERS.ALL.length - 2)
    minigames.push({ type: "wildcard_all_colors" });

  // If any minigames are triggered, update the game
  if (minigames.length > 0) {
    game.minigameActive = true;
    game.currentMinigame = minigames[0].type;
    game.minigameData = minigames[0];

    // Save to database if using MongoDB
    if (isUsingMongoDB()) {
      try {
        FlowerGame.updateOne(
          { hostId },
          {
            $set: {
              minigameActive: true,
              currentMinigame: minigames[0].type,
              minigameData: minigames[0],
            },
          }
        ).catch((err) => console.error("Error updating minigame data:", err));
      } catch (error) {
        console.error("Failed to update minigame data in database:", error);
      }
    } else {
      saveFlowerGamesToFile();
    }

    return {
      minigames,
      currentMinigame: minigames[0],
    };
  }

  return null;
}

/**
 * Process a Rainbow Mania minigame
 * @param {string} hostId - The host's Discord ID
 * @param {Object} choices - Map of player IDs to their choices
 * @returns {Object} Results of the minigame
 */
async function processRainbowManiaMinigame(hostId, choices) {
  const game = activeFlowerGames.get(hostId);
  if (!game || game.gameType !== "rainbow_mania" || !game.minigameActive) {
    throw new Error("No active Rainbow Mania minigame.");
  }

  const minigameType = game.currentMinigame;
  const results = {};

  // Process based on minigame type
  if (
    minigameType.startsWith("hot_lucky_pick") ||
    minigameType.startsWith("cold_lucky_pick")
  ) {
    const count = game.minigameData.count;
    const maxMultiplier =
      count === 5 ? 5 : count === 6 ? 10 : count === 7 ? 15 : 20;

    // Process each player's choice
    for (const [playerId, choice] of Object.entries(choices)) {
      const choiceNum = parseInt(choice);
      if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > 5) {
        results[playerId] = {
          success: false,
          message: "Invalid choice. Must be 1-5.",
        };
        continue;
      }

      // Calculate multiplier based on choice
      const multiplier = Math.floor(Math.random() * maxMultiplier) + 1;
      results[playerId] = { success: true, multiplier };
    }
  } else if (minigameType === "rainbow_pick") {
    const count = game.minigameData.count;
    const maxMultiplier = count >= 5 ? 100 : 10;

    // Process each player's choice
    for (const [playerId, choice] of Object.entries(choices)) {
      const choiceNum = parseInt(choice);
      if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > 5) {
        results[playerId] = {
          success: false,
          message: "Invalid choice. Must be 1-5.",
        };
        continue;
      }

      // Calculate multiplier based on choice and rainbow count
      const baseMultiplier =
        count >= 5 ? [20, 40, 60, 80, 100] : [2, 4, 6, 8, 10];
      const multiplier = baseMultiplier[choiceNum - 1];
      results[playerId] = { success: true, multiplier };
    }
  } else if (minigameType === "wildcard_four_same_color") {
    // Process each player's choice
    for (const [playerId, choice] of Object.entries(choices)) {
      const colors = choice.split(",").map((c) => c.trim().toLowerCase());
      if (
        colors.length !== 2 ||
        !colors.every((c) => FLOWERS.ALL.includes(c))
      ) {
        results[playerId] = {
          success: false,
          message: "Invalid choice. Must be two valid colors.",
        };
        continue;
      }

      // Generate 5 random flowers
      const randomFlowers = [];
      for (let i = 0; i < 5; i++) {
        const randomIndex = Math.floor(Math.random() * FLOWERS.ALL.length);
        randomFlowers.push(FLOWERS.ALL[randomIndex]);
      }

      // Count matches
      const matches = colors.filter((c) => randomFlowers.includes(c)).length;
      const multiplier = matches * 4; // 4x for each match

      results[playerId] = {
        success: true,
        multiplier,
        flowers: randomFlowers,
        matches,
      };
    }
  } else if (minigameType === "wildcard_one_black_white") {
    // Random selection of minigame type with doubled payouts
    const minigameTypes = ["hot_lucky_pick", "cold_lucky_pick", "rainbow_pick"];
    const selectedMinigame =
      minigameTypes[Math.floor(Math.random() * minigameTypes.length)];

    // Process like the selected minigame but with doubled multipliers
    for (const [playerId, choice] of Object.entries(choices)) {
      const choiceNum = parseInt(choice);
      if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > 5) {
        results[playerId] = {
          success: false,
          message: "Invalid choice. Must be 1-5.",
        };
        continue;
      }

      let multiplier;
      if (selectedMinigame === "rainbow_pick") {
        const baseMultiplier = [2, 4, 6, 8, 10];
        multiplier = baseMultiplier[choiceNum - 1] * 2; // Double for black/white bonus
      } else {
        multiplier = (Math.floor(Math.random() * 5) + 1) * 2; // Double for black/white bonus
      }

      results[playerId] = {
        success: true,
        multiplier,
        minigameType: selectedMinigame,
      };
    }
  } else if (minigameType === "wildcard_two_black_white") {
    // Same as one black/white but with 4x multiplier
    const minigameTypes = ["hot_lucky_pick", "cold_lucky_pick", "rainbow_pick"];
    const selectedMinigame =
      minigameTypes[Math.floor(Math.random() * minigameTypes.length)];

    for (const [playerId, choice] of Object.entries(choices)) {
      const choiceNum = parseInt(choice);
      if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > 5) {
        results[playerId] = {
          success: false,
          message: "Invalid choice. Must be 1-5.",
        };
        continue;
      }

      let multiplier;
      if (selectedMinigame === "rainbow_pick") {
        const baseMultiplier = [2, 4, 6, 8, 10];
        multiplier = baseMultiplier[choiceNum - 1] * 4; // 4x for two black/white bonus
      } else {
        multiplier = (Math.floor(Math.random() * 5) + 1) * 4; // 4x for two black/white bonus
      }

      results[playerId] = {
        success: true,
        multiplier,
        minigameType: selectedMinigame,
      };
    }
  } else if (minigameType === "wildcard_all_colors") {
    // Sixshooter game
    for (const [playerId, choice] of Object.entries(choices)) {
      const color = choice.trim().toLowerCase();
      if (!FLOWERS.ALL.includes(color)) {
        results[playerId] = {
          success: false,
          message: "Invalid color choice.",
        };
        continue;
      }

      // Generate 6 random flowers
      const randomFlowers = [];
      for (let i = 0; i < 6; i++) {
        const randomIndex = Math.floor(Math.random() * FLOWERS.ALL.length);
        randomFlowers.push(FLOWERS.ALL[randomIndex]);
      }

      // Count matches
      const matches = randomFlowers.filter((f) => f === color).length;

      // Calculate multiplier: 5x for 0-1 matches, doubling for each additional match
      let multiplier = 5;
      for (let i = 1; i < matches; i++) {
        multiplier *= 2;
      }

      results[playerId] = {
        success: true,
        multiplier,
        flowers: randomFlowers,
        matches,
      };
    }
  }

  // Update game with results
  game.minigameData.results = results;
  game.minigameActive = false; // Minigame is now complete

  // Save to database if using MongoDB
  if (isUsingMongoDB()) {
    try {
      await FlowerGame.updateOne(
        { hostId },
        {
          $set: {
            minigameActive: false,
            "minigameData.results": results,
          },
        }
      );
    } catch (error) {
      console.error("Failed to update minigame results in database:", error);
    }
  } else {
    saveFlowerGamesToFile();
  }

  return results;
}

/**
 * Calculate payout for a bet
 * @param {string} gameType - The type of flower game
 * @param {Object} bet - The bet object
 * @param {Array} selectedFlowers - Array of selected flowers
 * @param {Object} game - The full game object (for game-specific logic)
 * @returns {BigInt} The payout amount
 */
function calculatePayout(gameType, bet, selectedFlowers, game) {
  const betAmount = BigInt(bet.amount);
  const betType = bet.betType.toLowerCase();

  if (gameType === "hot_cold") {
    // Count hot and cold flowers
    const hotCount = selectedFlowers.filter((f) =>
      FLOWERS.HOT.includes(f)
    ).length;
    const coldCount = selectedFlowers.filter((f) =>
      FLOWERS.COLD.includes(f)
    ).length;

    if (betType === "hot" && hotCount > coldCount) {
      return betAmount * 2n; // 1:1 payout
    } else if (betType === "cold" && coldCount > hotCount) {
      return betAmount * 2n; // 1:1 payout
    } else if (betType === "tie" && hotCount === coldCount) {
      return betAmount * 3n; // 2:1 payout
    }
  } else if (gameType === "pairs") {
    // Count occurrences of each flower
    const counts = {};
    for (const flower of selectedFlowers) {
      counts[flower] = (counts[flower] || 0) + 1;
    }

    // Check for pairs
    const pairs = Object.values(counts).filter((count) => count >= 2).length;

    if (betType === "pair" && pairs === 1) {
      return betAmount * 2n; // 1:1 payout
    } else if (betType === "two_pair" && pairs === 2) {
      return betAmount * 4n; // 3:1 payout
    } else if (
      betType === "three_kind" &&
      Object.values(counts).some((count) => count >= 3)
    ) {
      return betAmount * 5n; // 4:1 payout
    }
  } else if (gameType === "custom") {
    // Custom game logic - can be expanded based on specific requirements
    if (betType === "rainbow" && selectedFlowers.includes("rainbow")) {
      return betAmount * 3n; // 2:1 payout
    } else if (betType === "black" && selectedFlowers.includes("black")) {
      return betAmount * 3n; // 2:1 payout
    } else if (
      FLOWERS.ALL.includes(betType) &&
      selectedFlowers.includes(betType)
    ) {
      return betAmount * 2n; // 1:1 payout for specific flower
    }
  } else if (gameType === "flower_poker") {
    if (!game.hostHand || !game.playerHand) {
      return 0n; // No payout if hands aren't set
    }

    const hostHandRank = evaluatePokerHand(game.hostHand);
    const playerHandRank = evaluatePokerHand(game.playerHand);

    if (betType === "host" && hostHandRank.rank > playerHandRank.rank) {
      return betAmount * 2n; // 1:1 payout
    } else if (
      betType === "player" &&
      playerHandRank.rank > hostHandRank.rank
    ) {
      return betAmount * 2n; // 1:1 payout
    }
    // If it's a tie, check the highest card
    else if (
      betType === "host" &&
      hostHandRank.rank === playerHandRank.rank &&
      hostHandRank.highCard > playerHandRank.highCard
    ) {
      return betAmount * 2n;
    } else if (
      betType === "player" &&
      playerHandRank.rank === hostHandRank.rank &&
      playerHandRank.highCard > hostHandRank.highCard
    ) {
      return betAmount * 2n;
    }
  } else if (gameType === "rainbow_mania") {
    // Check if there are minigame results for this bet
    if (
      game.minigameData &&
      game.minigameData.results &&
      game.minigameData.results[bet.playerId]
    ) {
      const result = game.minigameData.results[bet.playerId];
      if (result.success && result.multiplier) {
        return betAmount * BigInt(result.multiplier);
      }
    }

    // If no minigame results, check basic win conditions
    const hotCount = selectedFlowers.filter((f) =>
      FLOWERS.HOT.includes(f)
    ).length;
    const coldCount = selectedFlowers.filter((f) =>
      FLOWERS.COLD.includes(f)
    ).length;
    const rainbowCount = selectedFlowers.filter((f) => f === "rainbow").length;

    if (betType === "hot" && hotCount > coldCount) {
      return betAmount * 2n; // 1:1 payout
    } else if (betType === "cold" && coldCount > hotCount) {
      return betAmount * 2n; // 1:1 payout
    } else if (betType === "rainbow" && rainbowCount > 0) {
      return betAmount * (2n + BigInt(rainbowCount)); // 1:1 + bonus for each rainbow
    } else if (betType === "wildcard") {
      // Wildcard has special minigames, but if no minigame was triggered
      // give a small consolation payout if there's at least one special flower
      const specialCount = selectedFlowers.filter((f) =>
        FLOWERS.SPECIAL.includes(f)
      ).length;

      if (specialCount > 0) {
        return betAmount * 2n; // 1:1 payout
      }
    }
  }

  return 0n; // No payout
}

/**
 * Evaluate a poker hand of flowers
 * @param {Array} hand - Array of 5 flowers
 * @returns {Object} Hand rank and high card
 */
function evaluatePokerHand(hand) {
  // Count occurrences of each flower
  const counts = {};
  for (const flower of hand) {
    counts[flower] = (counts[flower] || 0) + 1;
  }

  const values = Object.values(counts);

  // Check for five of a kind
  if (values.includes(5)) {
    return { rank: 7, highCard: getHighCardValue(hand) };
  }

  // Check for four of a kind
  if (values.includes(4)) {
    return { rank: 6, highCard: getHighCardValue(hand) };
  }

  // Check for full house (3 of a kind and a pair)
  if (values.includes(3) && values.includes(2)) {
    return { rank: 5, highCard: getHighCardValue(hand) };
  }

  // Check for three of a kind
  if (values.includes(3)) {
    return { rank: 3, highCard: getHighCardValue(hand) };
  }

  // Check for two pair
  if (values.filter((v) => v === 2).length === 2) {
    return { rank: 2, highCard: getHighCardValue(hand) };
  }

  // Check for one pair
  if (values.includes(2)) {
    return { rank: 1, highCard: getHighCardValue(hand) };
  }

  // High card
  return { rank: 0, highCard: getHighCardValue(hand) };
}

/**
 * Get the high card value from a hand
 * @param {Array} hand - Array of flowers
 * @returns {number} High card value
 */
function getHighCardValue(hand) {
  // Assign values to flowers (arbitrary for this game)
  const flowerValues = {
    rainbow: 9,
    black: 8,
    white: 7,
    red: 6,
    orange: 5,
    yellow: 4,
    blue: 3,
    purple: 2,
    pastel: 1,
  };

  // Find the highest value flower
  let highestValue = 0;
  for (const flower of hand) {
    if (flowerValues[flower] > highestValue) {
      highestValue = flowerValues[flower];
    }
  }

  return highestValue;
}

/**
 * Process payouts for a flower game
 * @param {string} hostId - The host's Discord ID
 * @returns {Object} Results object with winners and losers
 */
async function processPayouts(hostId) {
  const game = activeFlowerGames.get(hostId);
  if (!game) {
    throw new Error("You do not have an active flower game.");
  }

  if (game.selectedFlowers.length === 0) {
    throw new Error("You must select flowers before processing payouts.");
  }

  const results = {
    winners: [],
    losers: [],
    flowers: game.selectedFlowers,
  };

  // Import StatsManager
  const { updateStats } = require("./StatsManager");

  for (const bet of game.bets) {
    try {
      const payout = calculatePayout(
        game.gameType,
        bet,
        game.selectedFlowers,
        game
      );
      const playerWallet = await getWallet(bet.playerId);
      const betAmount = BigInt(bet.amount);
      const walletBalance = BigInt(playerWallet[bet.currency] || 0);

      if (payout > 0n) {
        // Update wallet with payout
        playerWallet[bet.currency] = (walletBalance + payout).toString();
        await updateWallet(bet.playerId, playerWallet);

        // Update stats for winner
        try {
          // Create an enhanced bet object with payout information
          const betWithPayout = {
            ...bet,
            amount: betAmount,
            payout: payout,
          };

          await updateStats(
            bet.playerId,
            "win",
            "flower",
            betWithPayout,
            hostId
          );
        } catch (statsError) {
          console.error(
            `Error updating stats for user ${bet.playerId}:`,
            statsError
          );
        }

        results.winners.push({
          playerId: bet.playerId,
          profit: (payout - betAmount).toString(),
          currency: bet.currency,
        });
      } else {
        // Update stats for loser
        try {
          const betWithBigInt = {
            ...bet,
            amount: betAmount,
          };

          await updateStats(
            bet.playerId,
            "loss",
            "flower",
            betWithBigInt,
            hostId
          );
        } catch (statsError) {
          console.error(
            `Error updating stats for user ${bet.playerId}:`,
            statsError
          );
        }

        results.losers.push({
          playerId: bet.playerId,
          amount: betAmount.toString(),
          currency: bet.currency,
        });
      }
    } catch (error) {
      console.error(
        `Error processing payout for player ${bet.playerId}:`,
        error
      );
    }
  }

  // Update host stats
  try {
    // Create a dummy bet object for the host
    const hostBet = {
      currency: "osrs", // Default currency
      amount: 0n,
    };

    await updateStats(hostId, "host", "flower", hostBet);
  } catch (statsError) {
    console.error(`Error updating host stats for user ${hostId}:`, statsError);
  }

  // End the game
  if (isUsingMongoDB()) {
    try {
      await FlowerGame.deleteOne({ hostId });
    } catch (error) {
      console.error("Failed to delete flower game from database:", error);
      // Continue with in-memory version
    }
  }

  activeFlowerGames.delete(hostId);

  if (!isUsingMongoDB()) {
    saveFlowerGamesToFile();
  }

  return results;
}
/**
 * Cancel a flower game and refund all bets
 * @param {string} hostId - The host's Discord ID
 * @returns {Object} Results object with refunded bets
 */
async function cancelGame(hostId) {
  const game = activeFlowerGames.get(hostId);
  if (!game) {
    throw new Error("You do not have an active flower game.");
  }

  // Refund all bets
  const refunds = [];
  for (const bet of game.bets) {
    try {
      const playerWallet = await getWallet(bet.playerId);
      const walletBalance = BigInt(playerWallet[bet.currency] || 0);
      const betAmount = BigInt(bet.amount);

      // Update wallet with refund - FIX: Use BigInt operations
      playerWallet[bet.currency] = (walletBalance + betAmount).toString();
      await updateWallet(bet.playerId, playerWallet);

      refunds.push({
        playerId: bet.playerId,
        amount: bet.amount,
        currency: bet.currency,
      });
    } catch (error) {
      console.error(`Error refunding bet for player ${bet.playerId}:`, error);
    }
  }

  // End the game
  if (isUsingMongoDB()) {
    try {
      await FlowerGame.deleteOne({ hostId });
    } catch (error) {
      console.error("Failed to delete flower game from database:", error);
      // Continue with in-memory version
    }
  }

  activeFlowerGames.delete(hostId);

  if (!isUsingMongoDB()) {
    saveFlowerGamesToFile();
  }

  return { refunds };
}

/**
 * Load active flower games from storage
 * @returns {void}
 */
async function loadActiveFlowerGames() {
  activeFlowerGames.clear();

  if (isUsingMongoDB() && mongoose.connection.readyState === 1) {
    try {
      // Make sure FlowerGame is defined
      if (!FlowerGame) {
        console.warn(
          "⚠️ FlowerGame model not defined yet, skipping database load"
        );
        return loadFlowerGamesFromFile();
      }

      const games = await FlowerGame.find({});
      for (const game of games) {
        activeFlowerGames.set(game.hostId, game.toObject());
      }
      console.log(
        `✅ Loaded ${activeFlowerGames.size} active flower games from database.`
      );
    } catch (error) {
      console.error(
        "❌ Failed to load active flower games from database:",
        error
      );
      // Fall back to file-based storage
      loadFlowerGamesFromFile();
    }
  } else {
    loadFlowerGamesFromFile();
  }
}

/**
 * Create an embed for a flower game
 * @param {Object} game - The flower game
 * @param {Object} host - The host user object
 * @param {Object} client - The Discord client
 * @returns {Object} The embed object
 */
async function createFlowerGameEmbed(game, host, client) {
  const userProfile = await UserProfile.findOne({ userId: host.id });
  const twitchUsername = userProfile?.twitchUsername;

  // Format game type for display
  let displayGameType = game.gameType;
  if (game.gameType === "hot_cold") displayGameType = "Hot/Cold";
  else if (game.gameType === "flower_poker") displayGameType = "Flower Poker";
  else if (game.gameType === "rainbow_mania") displayGameType = "Rainbow Mania";
  else
    displayGameType =
      game.gameType.charAt(0).toUpperCase() + game.gameType.slice(1);

  const embed = new EmbedBuilder()
    .setColor(0x4caf50)
    .setTitle(`${EMOJIS.cards} ${displayGameType} Game Open`)
    .setDescription(
      `*${host.username}'s ${displayGameType} game is open for bets.*`
    )
    .setThumbnail(host.displayAvatarURL())
    .setFooter({
      text: `"Flowers bloom, fortunes change"`,
      iconURL: client.user.displayAvatarURL(),
    });

  if (twitchUsername) {
    embed.setURL(`https://www.twitch.tv/${twitchUsername}`);
    embed.setTitle(
      `${EMOJIS.cards} ${displayGameType} Game Open (Live on Twitch!)`
    );
  }

  if (game.bets && game.bets.length > 0) {
    const osrsBets = game.bets.filter((b) => b.currency === "osrs");
    const rs3Bets = game.bets.filter((b) => b.currency === "rs3");

    // Convert string amounts to BigInt, sum them, then convert back to string for formatting
    const totalOsrs = osrsBets.reduce((sum, b) => sum + BigInt(b.amount), 0n);
    const totalRs3 = rs3Bets.reduce((sum, b) => sum + BigInt(b.amount), 0n);

    embed.addFields({
      name: `${EMOJIS.host} Host: ${host.username} • ${displayGameType}`,
      value: `${game.bets.length} bets • ${formatAmount(
        totalOsrs
      )} 07 • ${formatAmount(totalRs3)} RS3`,
      inline: false,
    });
  } else {
    embed.addFields({
      name: `${EMOJIS.host} Host: ${host.username} • ${displayGameType}`,
      value: "*No bets yet. Be the first.*",
      inline: false,
    });
  }

  // Add game-specific information
  if (game.gameType === "flower_poker") {
    embed.addFields({
      name: "Game Rules",
      value:
        "Compare 5 flowers for host vs players. Pairs, three of a kind, full house, four of a kind, and five of a kind determine the winner.",
      inline: false,
    });
  } else if (game.gameType === "rainbow_mania") {
    embed.addFields({
      name: "Game Rules",
      value:
        "Bet on hot, cold, rainbow, or wildcard. Special combinations trigger bonus minigames with multipliers!",
      inline: false,
    });
  }

  return embed;
}

/**
 * Create an embed for Rainbow Mania minigame
 * @param {Object} game - The flower game
 * @param {Object} host - The host user object
 * @param {Object} minigameData - The minigame data
 * @returns {Object} The embed object
 */
function createMinigameEmbed(game, host, minigameData) {
  const embed = new EmbedBuilder()
    .setColor(0xff9800)
    .setTitle(`${EMOJIS.dice} Rainbow Mania Minigame!`)
    .setDescription(
      `A special minigame has been triggered in ${host.username}'s Rainbow Mania game!`
    )
    .setThumbnail(host.displayAvatarURL());

  const minigameType = minigameData.type;

  if (minigameType.startsWith("hot_lucky_pick")) {
    const count = minigameData.count;
    const maxMultiplier =
      count === 5 ? 5 : count === 6 ? 10 : count === 7 ? 15 : 20;

    embed.addFields(
      { name: "Minigame", value: "Hot Lucky Pick", inline: true },
      { name: "Hot Flowers", value: count.toString(), inline: true },
      { name: "Max Multiplier", value: `${maxMultiplier}x`, inline: true },
      {
        name: "How to Play",
        value: "Choose a number between 1-5 to reveal your multiplier!",
      }
    );
  } else if (minigameType.startsWith("cold_lucky_pick")) {
    const count = minigameData.count;
    const maxMultiplier =
      count === 5 ? 5 : count === 6 ? 10 : count === 7 ? 15 : 20;

    embed.addFields(
      { name: "Minigame", value: "Cold Lucky Pick", inline: true },
      { name: "Cold Flowers", value: count.toString(), inline: true },
      { name: "Max Multiplier", value: `${maxMultiplier}x`, inline: true },
      {
        name: "How to Play",
        value: "Choose a number between 1-5 to reveal your multiplier!",
      }
    );
  } else if (minigameType === "rainbow_pick") {
    const count = minigameData.count;
    const maxMultiplier = count >= 5 ? 100 : 10;

    embed.addFields(
      { name: "Minigame", value: "Rainbow Pick", inline: true },
      { name: "Rainbow Count", value: count.toString(), inline: true },
      { name: "Max Multiplier", value: `${maxMultiplier}x`, inline: true },
      {
        name: "How to Play",
        value: "Choose a number between 1-5 to reveal your multiplier!",
      }
    );
  } else if (minigameType === "wildcard_four_same_color") {
    embed.addFields(
      { name: "Minigame", value: "Four of a Kind", inline: true },
      { name: "Multiplier", value: "4x per match", inline: true },
      {
        name: "How to Play",
        value:
          "Choose two colors. The host will plant 5 flowers. For each color you picked that appears, you win 4x your bet!",
      }
    );
  } else if (minigameType === "wildcard_one_black_white") {
    embed.addFields(
      { name: "Minigame", value: "Black or White Special", inline: true },
      { name: "Bonus", value: "2x multiplier", inline: true },
      {
        name: "How to Play",
        value:
          "Choose a number between 1-5 to play a random minigame with doubled payouts!",
      }
    );
  } else if (minigameType === "wildcard_two_black_white") {
    embed.addFields(
      { name: "Minigame", value: "Double Black/White Special", inline: true },
      { name: "Bonus", value: "4x multiplier", inline: true },
      {
        name: "How to Play",
        value:
          "Choose a number between 1-5 to play a random minigame with quadrupled payouts!",
      }
    );
  } else if (minigameType === "wildcard_all_colors") {
    embed.addFields(
      { name: "Minigame", value: "Sixshooter", inline: true },
      { name: "Base Multiplier", value: "5x", inline: true },
      {
        name: "How to Play",
        value:
          "Choose a flower color. The host will plant 6 flowers. Get 0-1 matches for 5x, 2 matches for 10x, 3 matches for 20x, and so on!",
      }
    );
  }

  return embed;
}

/**
 * Create buttons for a Rainbow Mania minigame
 * @param {string} minigameType - The type of minigame
 * @returns {Array} Array of action rows with buttons
 */
function createMinigameButtons(minigameType) {
  if (
    minigameType.startsWith("hot_lucky_pick") ||
    minigameType.startsWith("cold_lucky_pick") ||
    minigameType === "rainbow_pick" ||
    minigameType === "wildcard_one_black_white" ||
    minigameType === "wildcard_two_black_white"
  ) {
    // Create 5 number buttons
    const buttons = [];
    for (let i = 1; i <= 5; i++) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`minigame_choice:${i}`)
          .setLabel(`${i}`)
          .setStyle(ButtonStyle.Primary)
      );
    }

    return [new ActionRowBuilder().addComponents(...buttons)];
  } else if (minigameType === "wildcard_four_same_color") {
    // Create color selection buttons
    const colorRows = [];
    const colors = [
      "red",
      "orange",
      "yellow",
      "blue",
      "purple",
      "white",
      "black",
      "rainbow",
      "pastel",
    ];

    // Split into rows of 3
    for (let i = 0; i < colors.length; i += 3) {
      const rowButtons = [];
      for (let j = 0; j < 3 && i + j < colors.length; j++) {
        const color = colors[i + j];
        rowButtons.push(
          new ButtonBuilder()
            .setCustomId(`minigame_color:${color}`)
            .setLabel(color.charAt(0).toUpperCase() + color.slice(1))
            .setStyle(ButtonStyle.Secondary)
        );
      }
      colorRows.push(new ActionRowBuilder().addComponents(...rowButtons));
    }

    return colorRows;
  } else if (minigameType === "wildcard_all_colors") {
    // Create color selection buttons (one row)
    const colors = ["red", "orange", "yellow", "blue", "purple", "rainbow"];
    const buttons = colors.map((color) =>
      new ButtonBuilder()
        .setCustomId(`minigame_color:${color}`)
        .setLabel(color.charAt(0).toUpperCase() + color.slice(1))
        .setStyle(ButtonStyle.Secondary)
    );

    return [new ActionRowBuilder().addComponents(...buttons)];
  }

  return [];
}

module.exports = {
  FLOWERS,
  createFlowerGame,
  getFlowerGame,
  getActiveFlowerGames,
  addBet,
  closeBetting,
  selectFlowers,
  processPayouts,
  cancelGame,
  loadActiveFlowerGames,
  createFlowerGameEmbed,
  validateBetType,
  saveFlowerGamesToFile,
  // New functions for game modes
  evaluatePokerHand,
  checkRainbowManiaMinigames,
  processRainbowManiaMinigame,
  createMinigameEmbed,
  createMinigameButtons,
};
