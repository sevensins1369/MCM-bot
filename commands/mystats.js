// commands/mystats.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getPlayerStats } = require("../utils/PlayerStatsManager");
const { formatAmount, EMOJIS } = require("../utils/embedcreator");
const { logger } = require("../enhanced-logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mystats")
    .setDescription("View your gaming statistics.")
    .addStringOption((option) =>
      option
        .setName("timeframe")
        .setDescription("The timeframe to view.")
        .setRequired(false)
        .addChoices(
          { name: "All Time", value: "allTime" },
          { name: "Daily", value: "daily" },
          { name: "Weekly", value: "weekly" },
          { name: "Monthly", value: "monthly" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("game_type")
        .setDescription("Filter by specific game type.")
        .setRequired(false)
        .addChoices(
          { name: "All Games", value: "all" },
          { name: "Duels", value: "duels" },
          { name: "Dice", value: "dice" },
          { name: "Dice Duels", value: "diceduels" },
          { name: "Flower Games", value: "flowers" },
          { name: "Hot/Cold", value: "hotcold" }
        )
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const timeframe = interaction.options.getString("timeframe") || "allTime";
      const gameType = interaction.options.getString("game_type") || "all";
      const userId = interaction.user.id;

      logger.info(
        "MyStatsCommand",
        `Stats requested by ${interaction.user.tag}`,
        {
          timeframe,
          gameType,
        }
      );

      // Get player stats
      const playerStats = await getPlayerStats(userId);
      if (!playerStats) {
        return interaction.editReply(
          "No stats found. Start playing to see your statistics!"
        );
      }

      // Create embed
      const embed = createStatsEmbed(
        playerStats,
        timeframe,
        gameType,
        interaction.user
      );

      await interaction.editReply({ embeds: [embed] });

      logger.info(
        "MyStatsCommand",
        `Stats displayed successfully for ${interaction.user.tag}`
      );
    } catch (error) {
      logger.error(
        "MyStatsCommand",
        `Error in /mystats command: ${error.message}`,
        error
      );
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: `❌ An error occurred while fetching your stats: ${error.message}`,
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      // Default values
      let timeframe = "allTime";
      let gameType = "all";

      // Parse arguments
      if (args.length > 0) {
        // Check for timeframe
        const timeframeArg = args[0].toLowerCase();
        if (["alltime", "daily", "weekly", "monthly"].includes(timeframeArg)) {
          timeframe = timeframeArg === "alltime" ? "allTime" : timeframeArg;
          args.shift(); // Remove the processed argument
        }

        // Check for game type
        if (args.length > 0) {
          const gameTypeArg = args[0].toLowerCase();
          if (
            [
              "all",
              "duels",
              "dice",
              "diceduels",
              "flowers",
              "hotcold",
            ].includes(gameTypeArg)
          ) {
            gameType = gameTypeArg;
          }
        }
      }

      const userId = message.author.id;

      logger.info(
        "MyStatsCommand",
        `Stats requested by ${message.author.tag} (prefix)`,
        {
          timeframe,
          gameType,
        }
      );

      // Get player stats
      const playerStats = await getPlayerStats(userId);
      if (!playerStats) {
        return message.reply(
          "No stats found. Start playing to see your statistics!"
        );
      }

      // Create embed
      const embed = createStatsEmbed(
        playerStats,
        timeframe,
        gameType,
        message.author
      );

      await message.reply({ embeds: [embed] });

      logger.info(
        "MyStatsCommand",
        `Stats displayed successfully for ${message.author.tag} (prefix)`
      );
    } catch (error) {
      logger.error(
        "MyStatsCommand",
        `Error in !mystats command: ${error.message}`,
        error
      );
      await message.reply(
        `❌ An error occurred while fetching your stats: ${error.message}`
      );
    }
  },

  // Command aliases
  aliases: ["ms", "stats"],
};

/**
 * Creates a stats embed with enhanced styling
 * @param {Object} playerStats - The player's stats
 * @param {string} timeframe - The timeframe to display
 * @param {string} gameType - The game type to filter by
 * @param {Object} user - The user object
 * @returns {EmbedBuilder} The created embed
 */
function createStatsEmbed(playerStats, timeframe, gameType, user) {
  // Format timeframe for display
  const displayTimeframe =
    timeframe === "allTime" ? "All Time" : capitalizeFirstLetter(timeframe);

  // Choose color based on win rate
  const color = getColorByWinRate(playerStats, timeframe, gameType);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${EMOJIS.stash} ${user.username}'s Gaming Statistics`)
    .setDescription(
      `**${displayTimeframe}** Stats${
        gameType !== "all" ? ` • ${capitalizeFirstLetter(gameType)}` : ""
      }`
    )
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setTimestamp();

  // Add fields based on game type
  if (gameType === "all" || gameType === "duels") {
    addDuelStats(embed, playerStats, timeframe);
  }

  if (gameType === "all" || gameType === "dice") {
    addDiceStats(embed, playerStats, timeframe);
  }

  if (gameType === "all" || gameType === "diceduels") {
    addDiceDuelStats(embed, playerStats, timeframe);
  }

  if (gameType === "all" || gameType === "flowers") {
    addFlowerStats(embed, playerStats, timeframe);
  }

  if (gameType === "all" || gameType === "hotcold") {
    addHotColdStats(embed, playerStats, timeframe);
  }

  // Add overall stats if showing all games
  if (gameType === "all") {
    addOverallStats(embed, playerStats, timeframe);
  }

  return embed;
}

/**
 * Adds duel stats to the embed
 * @param {EmbedBuilder} embed - The embed to add fields to
 * @param {Object} playerStats - The player's stats
 * @param {string} timeframe - The timeframe to display
 */
function addDuelStats(embed, playerStats, timeframe) {
  const stats = (playerStats && playerStats[timeframe]) ? playerStats[timeframe] : {};

  const duelsWon = stats.duelsWon || 0;
  const duelsLost = stats.duelsLost || 0;
  const totalDuels = duelsWon + duelsLost;
  const winRate =
    totalDuels > 0 ? ((duelsWon / totalDuels) * 100).toFixed(1) : "0.0";

  const osrsProfit = BigInt(stats.osrsProfit || "0");
  const rs3Profit = BigInt(stats.rs3Profit || "0");

  const osrsWagered = BigInt(stats.osrsWagered || "0");
  const rs3Wagered = BigInt(stats.rs3Wagered || "0");

  embed.addFields({
    name: "🗡️ Duels",
    value:
      `Wins: **${duelsWon}** | Losses: **${duelsLost}**\n` +
      `Total Duels: **${totalDuels}** | Win Rate: **${winRate}%**\n` +
      `osrs Profit: **${formatAmount(
        osrsProfit
      )}** | RS3 Profit: **${formatAmount(rs3Profit)}**\n` +
      `osrs Wagered: **${formatAmount(
        osrsWagered
      )}** | RS3 Wagered: **${formatAmount(rs3Wagered)}**`,
    inline: false,
  });
}

/**
 * Adds dice stats to the embed
 * @param {EmbedBuilder} embed - The embed to add fields to
 * @param {Object} playerStats - The player's stats
 * @param {string} timeframe - The timeframe to display
 */
function addDiceStats(embed, playerStats, timeframe) {
  const stats = (playerStats && playerStats[timeframe]) ? playerStats[timeframe] : {};

  const diceWon = stats.diceWon || 0;
  const diceLost = stats.diceLost || 0;
  const totalDice = diceWon + diceLost;
  const winRate =
    totalDice > 0 ? ((diceWon / totalDice) * 100).toFixed(1) : "0.0";

  const diceOsrsProfit = BigInt(stats.diceOsrsProfit || "0");
  const diceRs3Profit = BigInt(stats.diceRs3Profit || "0");

  const diceOsrsWagered = BigInt(stats.diceOsrsWagered || "0");
  const diceRs3Wagered = BigInt(stats.diceRs3Wagered || "0");

  embed.addFields({
    name: "🎲 Dice",
    value:
      `Wins: **${diceWon}** | Losses: **${diceLost}**\n` +
      `Total Games: **${totalDice}** | Win Rate: **${winRate}%**\n` +
      `osrs Profit: **${formatAmount(
        diceOsrsProfit
      )}** | RS3 Profit: **${formatAmount(diceRs3Profit)}**\n` +
      `osrs Wagered: **${formatAmount(
        diceOsrsWagered
      )}** | RS3 Wagered: **${formatAmount(diceRs3Wagered)}**`,
    inline: false,
  });
}

/**
 * Adds dice duel stats to the embed
 * @param {EmbedBuilder} embed - The embed to add fields to
 * @param {Object} playerStats - The player's stats
 * @param {string} timeframe - The timeframe to display
 */
function addDiceDuelStats(embed, playerStats, timeframe) {
  const stats = (playerStats && playerStats[timeframe]) ? playerStats[timeframe] : {};

  const diceDuelsWon = stats.diceDuelsWon || 0;
  const diceDuelsLost = stats.diceDuelsLost || 0;
  const totalDiceDuels = diceDuelsWon + diceDuelsLost;
  const winRate =
    totalDiceDuels > 0
      ? ((diceDuelsWon / totalDiceDuels) * 100).toFixed(1)
      : "0.0";

  const diceDuelsOsrsProfit = BigInt(stats.diceDuelsOsrsProfit || "0");
  const diceDuelsRs3Profit = BigInt(stats.diceDuelsRs3Profit || "0");

  const diceDuelsOsrsWagered = BigInt(stats.diceDuelsOsrsWagered || "0");
  const diceDuelsRs3Wagered = BigInt(stats.diceDuelsRs3Wagered || "0");

  embed.addFields({
    name: "🎯 Dice Duels",
    value:
      `Wins: **${diceDuelsWon}** | Losses: **${diceDuelsLost}**\n` +
      `Total Duels: **${totalDiceDuels}** | Win Rate: **${winRate}%**\n` +
      `osrs Profit: **${formatAmount(
        diceDuelsOsrsProfit
      )}** | RS3 Profit: **${formatAmount(diceDuelsRs3Profit)}**\n` +
      `osrs Wagered: **${formatAmount(
        diceDuelsOsrsWagered
      )}** | RS3 Wagered: **${formatAmount(diceDuelsRs3Wagered)}**`,
    inline: false,
  });
}

/**
 * Adds flower stats to the embed
 * @param {EmbedBuilder} embed - The embed to add fields to
 * @param {Object} playerStats - The player's stats
 * @param {string} timeframe - The timeframe to display
 */
function addFlowerStats(embed, playerStats, timeframe) {
  const stats = (playerStats && playerStats[timeframe]) ? playerStats[timeframe] : {};

  const flowersWon = stats.flowersWon || 0;
  const flowersLost = stats.flowersLost || 0;
  const totalFlowers = flowersWon + flowersLost;
  const winRate =
    totalFlowers > 0 ? ((flowersWon / totalFlowers) * 100).toFixed(1) : "0.0";

  const flowersOsrsProfit = BigInt(stats.flowersOsrsProfit || "0");
  const flowersRs3Profit = BigInt(stats.flowersRs3Profit || "0");

  const flowersOsrsWagered = BigInt(stats.flowersOsrsWagered || "0");
  const flowersRs3Wagered = BigInt(stats.flowersRs3Wagered || "0");

  embed.addFields({
    name: "🌸 Flower Games",
    value:
      `Wins: **${flowersWon}** | Losses: **${flowersLost}**\n` +
      `Total Games: **${totalFlowers}** | Win Rate: **${winRate}%**\n` +
      `osrs Profit: **${formatAmount(
        flowersOsrsProfit
      )}** | RS3 Profit: **${formatAmount(flowersRs3Profit)}**\n` +
      `osrs Wagered: **${formatAmount(
        flowersOsrsWagered
      )}** | RS3 Wagered: **${formatAmount(flowersRs3Wagered)}**`,
    inline: false,
  });
}

/**
 * Adds hot/cold stats to the embed
 * @param {EmbedBuilder} embed - The embed to add fields to
 * @param {Object} playerStats - The player's stats
 * @param {string} timeframe - The timeframe to display
 */
function addHotColdStats(embed, playerStats, timeframe) {
  const stats = (playerStats && playerStats[timeframe]) ? playerStats[timeframe] : {};

  const hotColdWon = stats.hotColdWon || 0;
  const hotColdLost = stats.hotColdLost || 0;
  const totalHotCold = hotColdWon + hotColdLost;
  const winRate =
    totalHotCold > 0 ? ((hotColdWon / totalHotCold) * 100).toFixed(1) : "0.0";

  const hotColdOsrsProfit = BigInt(stats.hotColdOsrsProfit || "0");
  const hotColdRs3Profit = BigInt(stats.hotColdRs3Profit || "0");

  const hotColdOsrsWagered = BigInt(stats.hotColdOsrsWagered || "0");
  const hotColdRs3Wagered = BigInt(stats.hotColdRs3Wagered || "0");

  embed.addFields({
    name: "🔥❄️ Hot/Cold Games",
    value:
      `Wins: **${hotColdWon}** | Losses: **${hotColdLost}**\n` +
      `Total Games: **${totalHotCold}** | Win Rate: **${winRate}%**\n` +
      `osrs Profit: **${formatAmount(
        hotColdOsrsProfit
      )}** | RS3 Profit: **${formatAmount(hotColdRs3Profit)}**\n` +
      `osrs Wagered: **${formatAmount(
        hotColdOsrsWagered
      )}** | RS3 Wagered: **${formatAmount(hotColdRs3Wagered)}**`,
    inline: false,
  });
}

/**
 * Adds overall stats to the embed
 * @param {EmbedBuilder} embed - The embed to add fields to
 * @param {Object} playerStats - The player's stats
 * @param {string} timeframe - The timeframe to display
 */
function addOverallStats(embed, playerStats, timeframe) {
  const stats = (playerStats && playerStats[timeframe]) ? playerStats[timeframe] : {};

  // Calculate total wins and losses across all game types
  const totalWins =
    (stats.duelsWon || 0) +
    (stats.diceWon || 0) +
    (stats.diceDuelsWon || 0) +
    (stats.flowersWon || 0) +
    (stats.hotColdWon || 0);

  const totalLosses =
    (stats.duelsLost || 0) +
    (stats.diceLost || 0) +
    (stats.diceDuelsLost || 0) +
    (stats.flowersLost || 0) +
    (stats.hotColdLost || 0);

  const totalGames = totalWins + totalLosses;
  const overallWinRate =
    totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : "0.0";

  // Calculate total profit and wagered
  const totalOsrsProfit =
    BigInt(stats.osrsProfit || "0") +
    BigInt(stats.diceOsrsProfit || "0") +
    BigInt(stats.diceDuelsOsrsProfit || "0") +
    BigInt(stats.flowersOsrsProfit || "0") +
    BigInt(stats.hotColdOsrsProfit || "0");

  const totalRs3Profit =
    BigInt(stats.rs3Profit || "0") +
    BigInt(stats.diceRs3Profit || "0") +
    BigInt(stats.diceDuelsRs3Profit || "0") +
    BigInt(stats.flowersRs3Profit || "0") +
    BigInt(stats.hotColdRs3Profit || "0");

  const totalOsrsWagered =
    BigInt(stats.osrsWagered || "0") +
    BigInt(stats.diceOsrsWagered || "0") +
    BigInt(stats.diceDuelsOsrsWagered || "0") +
    BigInt(stats.flowersOsrsWagered || "0") +
    BigInt(stats.hotColdOsrsWagered || "0");

  const totalRs3Wagered =
    BigInt(stats.rs3Wagered || "0") +
    BigInt(stats.diceRs3Wagered || "0") +
    BigInt(stats.diceDuelsRs3Wagered || "0") +
    BigInt(stats.flowersRs3Wagered || "0") +
    BigInt(stats.hotColdRs3Wagered || "0");

  // Add donations if available
  const osrsDonated = BigInt(stats.osrsDonated || "0");
  const rs3Donated = BigInt(stats.rs3Donated || "0");

  embed.addFields({
    name: "📊 Overall Statistics",
    value:
      `Total Wins: **${totalWins}** | Total Losses: **${totalLosses}**\n` +
      `Total Games: **${totalGames}** | Overall Win Rate: **${overallWinRate}%**\n` +
      `Total osrs Profit: **${formatAmount(
        totalOsrsProfit
      )}** | Total RS3 Profit: **${formatAmount(totalRs3Profit)}**\n` +
      `Total osrs Wagered: **${formatAmount(
        totalOsrsWagered
      )}** | Total RS3 Wagered: **${formatAmount(totalRs3Wagered)}**\n` +
      `osrs Donated: **${formatAmount(
        osrsDonated
      )}** | RS3 Donated: **${formatAmount(rs3Donated)}**`,
    inline: false,
  });
}

/**
 * Gets a color based on win rate
 * @param {Object} playerStats - The player's stats
 * @param {string} timeframe - The timeframe to display
 * @param {string} gameType - The game type to filter by
 * @returns {number} The color code
 */
function getColorByWinRate(playerStats, timeframe, gameType) {
  const stats = (playerStats && playerStats[timeframe]) ? playerStats[timeframe] : {};
  let wins = 0;
  let losses = 0;

  if (gameType === "all") {
    wins =
      (stats.duelsWon || 0) +
      (stats.diceWon || 0) +
      (stats.diceDuelsWon || 0) +
      (stats.flowersWon || 0) +
      (stats.hotColdWon || 0);

    losses =
      (stats.duelsLost || 0) +
      (stats.diceLost || 0) +
      (stats.diceDuelsLost || 0) +
      (stats.flowersLost || 0) +
      (stats.hotColdLost || 0);
  } else if (gameType === "duels") {
    wins = stats.duelsWon || 0;
    losses = stats.duelsLost || 0;
  } else if (gameType === "dice") {
    wins = stats.diceWon || 0;
    losses = stats.diceLost || 0;
  } else if (gameType === "diceduels") {
    wins = stats.diceDuelsWon || 0;
    losses = stats.diceDuelsLost || 0;
  } else if (gameType === "flowers") {
    wins = stats.flowersWon || 0;
    losses = stats.flowersLost || 0;
  } else if (gameType === "hotcold") {
    wins = stats.hotColdWon || 0;
    losses = stats.hotColdLost || 0;
  }

  const total = wins + losses;
  const winRate = total > 0 ? (wins / total) * 100 : 0;

  // Color based on win rate
  if (winRate >= 60) return 0x00ff00; // Green for high win rate
  if (winRate >= 50) return 0xffd700; // Gold for average win rate
  if (winRate >= 40) return 0xffa500; // Orange for below average
  return 0xff0000; // Red for low win rate
}

/**
 * Capitalizes the first letter of a string
 * @param {string} string - The string to capitalize
 * @returns {string} The capitalized string
 */
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
