// commands/leaderboard.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getLeaderboardStats } = require("../utils/PlayerStatsManager");
const { formatAmount, EMOJIS } = require("../utils/embedcreator");
const { logger } = require("../enhanced-logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription(
      "View comprehensive game leaderboards with various filters."
    )
    .addStringOption((option) =>
      option
        .setName("currency")
        .setDescription("The currency to display stats for.")
        .setRequired(true)
        .addChoices(
          { name: "07", value: "osrs" },
          { name: "RS3", value: "rs3" }
        )
    )
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
        .setName("category")
        .setDescription("The category to rank by.")
        .setRequired(false)
        .addChoices(
          { name: "Profit", value: "profit" },
          { name: "Wagered", value: "wagered" },
          { name: "Losses", value: "losses" },
          { name: "Bets", value: "bets" },
          { name: "Donations", value: "donations" },
          { name: "Win Rate", value: "winrate" }
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
    )
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription("Number of users to show (default: 10).")
        .setMinValue(1)
        .setMaxValue(25)
    )
    .addIntegerOption((option) =>
      option
        .setName("page")
        .setDescription("Page number (default: 1).")
        .setMinValue(1)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const currency = interaction.options.getString("currency");
      const timeframe = interaction.options.getString("timeframe") || "allTime";
      const category = interaction.options.getString("category") || "wagered";
      const gameType = interaction.options.getString("game_type") || "all";
      const limit = interaction.options.getInteger("limit") || 10;
      const page = interaction.options.getInteger("page") || 1;
      const skip = (page - 1) * limit;

      logger.info(
        "LeaderboardCommand",
        `Leaderboard requested by ${interaction.user.tag}`,
        {
          currency,
          timeframe,
          category,
          gameType,
          limit,
          page,
        }
      );

      // Determine sort field and direction based on category and game type
      const { sortField, sortDirection, displayField, title } =
        getSortParameters(timeframe, category, currency, gameType);

      // Get leaderboard stats
      const { stats, totalCount } = await getLeaderboardStats(
        timeframe,
        sortField,
        sortDirection,
        skip,
        limit
      );

      if (stats.length === 0) {
        return interaction.editReply("No data found for this leaderboard.");
      }

      // Create embed with enhanced styling
      const embed = createLeaderboardEmbed(
        stats,
        title,
        timeframe,
        category,
        currency,
        gameType,
        page,
        limit,
        totalCount,
        skip,
        displayField
      );

      await interaction.editReply({ embeds: [embed] });

      logger.info(
        "LeaderboardCommand",
        `Leaderboard displayed successfully for ${interaction.user.tag}`
      );
    } catch (error) {
      logger.error(
        "LeaderboardCommand",
        `Error in /leaderboard command: ${error.message}`,
        error
      );
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: `❌ An error occurred while fetching the leaderboard: ${error.message}`,
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      // Default values
      let currency = "osrs";
      let timeframe = "allTime";
      let category = "wagered";
      let gameType = "all";
      let limit = 10;
      let page = 1;

      // Parse arguments
      if (args.length > 0) {
        // First arg should be currency
        const currencyArg = args[0].toLowerCase();
        if (["osrs", "osrs", "rs3"].includes(currencyArg)) {
          currency = currencyArg === "osrs" ? "osrs" : currencyArg;
          args.shift(); // Remove the processed argument
        } else {
          return message.reply(
            "❌ Invalid currency. Use 'osrs', 'osrs', or 'rs3'."
          );
        }

        // Process remaining args
        for (let i = 0; i < args.length; i++) {
          const arg = args[i].toLowerCase();

          // Check for timeframe
          if (["alltime", "daily", "weekly", "monthly"].includes(arg)) {
            timeframe = arg === "alltime" ? "allTime" : arg;
            continue;
          }

          // Check for category
          if (
            [
              "profit",
              "wagered",
              "losses",
              "bets",
              "donations",
              "winrate",
            ].includes(arg)
          ) {
            category = arg;
            continue;
          }

          // Check for game type
          if (
            [
              "all",
              "duels",
              "dice",
              "diceduels",
              "flowers",
              "hotcold",
            ].includes(arg)
          ) {
            gameType = arg;
            continue;
          }

          // Check for limit
          if (arg === "limit" && i + 1 < args.length) {
            const limitValue = parseInt(args[i + 1]);
            if (!isNaN(limitValue) && limitValue > 0 && limitValue <= 25) {
              limit = limitValue;
              i++; // Skip the next arg as we've processed it
            }
            continue;
          }

          // Check for page
          if (arg === "page" && i + 1 < args.length) {
            const pageValue = parseInt(args[i + 1]);
            if (!isNaN(pageValue) && pageValue > 0) {
              page = pageValue;
              i++; // Skip the next arg as we've processed it
            }
            continue;
          }
        }
      }

      const skip = (page - 1) * limit;

      logger.info(
        "LeaderboardCommand",
        `Leaderboard requested by ${message.author.tag} (prefix)`,
        {
          currency,
          timeframe,
          category,
          gameType,
          limit,
          page,
        }
      );

      // Determine sort field and direction based on category and game type
      const { sortField, sortDirection, displayField, title } =
        getSortParameters(timeframe, category, currency, gameType);

      // Get leaderboard stats
      const { stats, totalCount } = await getLeaderboardStats(
        timeframe,
        sortField,
        sortDirection,
        skip,
        limit
      );

      if (stats.length === 0) {
        return message.reply("No data found for this leaderboard.");
      }

      // Create embed with enhanced styling
      const embed = createLeaderboardEmbed(
        stats,
        title,
        timeframe,
        category,
        currency,
        gameType,
        page,
        limit,
        totalCount,
        skip,
        displayField
      );

      await message.reply({ embeds: [embed] });

      logger.info(
        "LeaderboardCommand",
        `Leaderboard displayed successfully for ${message.author.tag} (prefix)`
      );
    } catch (error) {
      logger.error(
        "LeaderboardCommand",
        `Error in !leaderboard command: ${error.message}`,
        error
      );
      await message.reply(
        `❌ An error occurred while fetching the leaderboard: ${error.message}`
      );
    }
  },

  // Command aliases
  aliases: ["lb", "top"],
};

/**
 * Determines sort parameters based on category, currency and game type
 * @param {string} timeframe - The timeframe to view
 * @param {string} category - The category to rank by
 * @param {string} currency - The currency to display stats for
 * @param {string} gameType - The game type to filter by
 * @returns {Object} Sort parameters
 */
function getSortParameters(timeframe, category, currency, gameType) {
  let sortField,
    sortDirection = -1,
    displayField,
    title;
  const currencyPrefix = currency === "osrs" ? "osrs" : "rs3";
  const gameTypePrefix = getGameTypePrefix(gameType);

  switch (category) {
    case "profit":
      sortField = `${timeframe}.${gameTypePrefix}${currencyPrefix}Profit`;
      displayField = `${gameTypePrefix}${currencyPrefix}Profit`;
      title = `Top ${currency.toUpperCase()} Profit`;
      break;
    case "wagered":
      sortField = `${timeframe}.${gameTypePrefix}${currencyPrefix}Wagered`;
      displayField = `${gameTypePrefix}${currencyPrefix}Wagered`;
      title = `Top ${currency.toUpperCase()} Wagered`;
      break;
    case "losses":
      sortField = `${timeframe}.${gameTypePrefix}${currencyPrefix}Profit`;
      sortDirection = 1; // Ascending for losses
      displayField = `${gameTypePrefix}${currencyPrefix}Profit`;
      title = `Top ${currency.toUpperCase()} Losses`;
      break;
    case "bets":
      sortField = `${timeframe}.${gameTypePrefix}betsWon`;
      displayField = `${gameTypePrefix}betsWon`;
      title = `Most ${currency.toUpperCase()} Bets`;
      break;
    case "donations":
      sortField = `${timeframe}.${currencyPrefix}Donated`;
      displayField = `${currencyPrefix}Donated`;
      title = `Top ${currency.toUpperCase()} Donators`;
      break;
    case "winrate":
      sortField = `${timeframe}.${gameTypePrefix}betsWon`;
      displayField = "winRate";
      title = `Best ${currency.toUpperCase()} Win Rate`;
      break;
    default:
      sortField = `${timeframe}.${gameTypePrefix}${currencyPrefix}Wagered`;
      displayField = `${gameTypePrefix}${currencyPrefix}Wagered`;
      title = `Top ${currency.toUpperCase()} Wagered`;
  }

  // Add game type to title if specific
  if (gameType !== "all") {
    title += ` (${formatGameTypeName(gameType)})`;
  }

  return { sortField, sortDirection, displayField, title };
}

/**
 * Gets the prefix for a game type to use in field names
 * @param {string} gameType - The game type
 * @returns {string} The prefix
 */
function getGameTypePrefix(gameType) {
  switch (gameType) {
    case "duels":
      return "duels";
    case "dice":
      return "dice";
    case "diceduels":
      return "diceDuels";
    case "flowers":
      return "flowers";
    case "hotcold":
      return "hotCold";
    default:
      return ""; // All games
  }
}

/**
 * Creates a leaderboard embed with enhanced styling
 * @param {Array} stats - The stats data
 * @param {string} title - The title for the embed
 * @param {string} timeframe - The timeframe
 * @param {string} category - The category
 * @param {string} currency - The currency
 * @param {string} gameType - The game type
 * @param {number} page - The current page
 * @param {number} limit - The number of entries per page
 * @param {number} totalCount - The total number of entries
 * @param {number} skip - The number of entries to skip
 * @param {string} displayField - The field to display
 * @returns {EmbedBuilder} The created embed
 */
function createLeaderboardEmbed(
  stats,
  title,
  timeframe,
  category,
  currency,
  gameType,
  page,
  limit,
  totalCount,
  skip,
  displayField
) {
  // Choose color based on currency
  const color = currency === "osrs" ? 0xdaa520 : 0x6495ed;

  // Choose emoji based on category
  let categoryEmoji;
  switch (category) {
    case "profit":
      categoryEmoji = EMOJIS.win;
      break;
    case "wagered":
      categoryEmoji = EMOJIS.stash;
      break;
    case "losses":
      categoryEmoji = EMOJIS.loss;
      break;
    case "bets":
      categoryEmoji = EMOJIS.dice;
      break;
    case "donations":
      categoryEmoji = EMOJIS.heart || "❤️";
      break;
    case "winrate":
      categoryEmoji = EMOJIS.crown || "👑";
      break;
    default:
      categoryEmoji = EMOJIS.stash;
  }

  // Format timeframe for display
  const displayTimeframe =
    timeframe === "allTime" ? "All Time" : capitalizeFirstLetter(timeframe);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${categoryEmoji} ${title}`)
    .setDescription(
      `**${displayTimeframe}** Leaderboard • Page ${page} of ${Math.ceil(
        totalCount / limit
      )}`
    )
    .setTimestamp();

  // Generate leaderboard text with enhanced formatting
  const leaderboardText = stats
    .map((stat, index) => {
      const position = skip + index + 1;
      let value;
      let displayValue;

      // Ensure stat and timeframe data exist
      const timeframeData = stat && stat[timeframe] ? stat[timeframe] : {};

      // Calculate the appropriate value based on category
      if (category === "bets") {
        // For bets, sum wins and losses
        const wins = timeframeData[`${getGameTypePrefix(gameType)}betsWon`] || 0;
        const losses = timeframeData[`${getGameTypePrefix(gameType)}betsLost`] || 0;
        value = wins + losses;
        displayValue = value.toString();
      } else if (category === "winrate") {
        // For win rate, calculate percentage
        const wins = timeframeData[`${getGameTypePrefix(gameType)}betsWon`] || 0;
        const losses = timeframeData[`${getGameTypePrefix(gameType)}betsLost`] || 0;
        const total = wins + losses;
        value = total > 0 ? (wins / total) * 100 : 0;
        displayValue = `${value.toFixed(1)}%`;
      } else {
        // For other categories, use the value directly
        value = BigInt(timeframeData[displayField] || "0");
        if (category === "losses" && value < 0n) {
          value = -value; // Make losses positive for display
        }
        displayValue = formatAmount(value);
      }

      // Format the position with medal emoji for top 3
      let positionDisplay;
      if (position === 1) {
        positionDisplay = "🥇";
      } else if (position === 2) {
        positionDisplay = "🥈";
      } else if (position === 3) {
        positionDisplay = "🥉";
      } else {
        positionDisplay = `${position}.`;
      }

      return `${positionDisplay} <@${stat.userId}> - **${displayValue}**`;
    })
    .join("\n");

  embed.addFields({
    name: "Leaderboard",
    value: leaderboardText || "No data available",
  });

  // Add footer with filters
  embed.setFooter({
    text: `Currency: ${currency.toUpperCase()} | Category: ${capitalizeFirstLetter(
      category
    )} | Game: ${formatGameTypeName(gameType)}`,
  });

  return embed;
}

/**
 * Helper function to format game type name for display
 * @param {string} gameType - The game type
 * @returns {string} Formatted game type name
 */
function formatGameTypeName(gameType) {
  switch (gameType) {
    case "duels":
      return "Duels";
    case "dice":
      return "Dice";
    case "diceduels":
      return "Dice Duels";
    case "flowers":
      return "Flower Games";
    case "hotcold":
      return "Hot/Cold";
    default:
      return "All Games";
  }
}

/**
 * Capitalizes the first letter of a string
 * @param {string} string - The string to capitalize
 * @returns {string} The capitalized string
 */
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
