// commands/flower-leaderboard.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getLeaderboardStats } = require("../utils/PlayerStatsManager");
const { formatAmount, EMOJIS } = require("../utils/embedcreator");
const { logger } = require("../utils/enhanced-logger");
const { withErrorHandling } = require("../utils/error-handler");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("flower-leaderboard")
    .setDescription("View the flower games leaderboard.")
    .addStringOption((option) =>
      option
        .setName("currency")
        .setDescription("The currency to view.")
        .setRequired(false)
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
          { name: "Games", value: "games" }
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

  execute: withErrorHandling(async function (interaction) {
    await interaction.deferReply();

    const currency = interaction.options.getString("currency") || "osrs";
    const timeframe = interaction.options.getString("timeframe") || "allTime";
    const category = interaction.options.getString("category") || "wagered";
    const limit = interaction.options.getInteger("limit") || 10;
    const page = interaction.options.getInteger("page") || 1;
    const skip = (page - 1) * limit;

    let sortField,
      sortDirection = -1,
      displayField,
      title;

    // Determine sort field and display field based on category and currency
    switch (category) {
      case "profit":
        sortField = `${timeframe}.flower${
          currency.charAt(0).toUpperCase() + currency.slice(1)
        }Profit`;
        displayField = `flower${
          currency.charAt(0).toUpperCase() + currency.slice(1)
        }Profit`;
        title = `Top Flower Games ${currency.toUpperCase()} Profit`;
        break;
      case "wagered":
        sortField = `${timeframe}.flower${
          currency.charAt(0).toUpperCase() + currency.slice(1)
        }Wagered`;
        displayField = `flower${
          currency.charAt(0).toUpperCase() + currency.slice(1)
        }Wagered`;
        title = `Top Flower Games ${currency.toUpperCase()} Wagered`;
        break;
      case "losses":
        sortField = `${timeframe}.flower${
          currency.charAt(0).toUpperCase() + currency.slice(1)
        }Profit`;
        sortDirection = 1; // Ascending for losses
        displayField = `flower${
          currency.charAt(0).toUpperCase() + currency.slice(1)
        }Profit`;
        title = `Top Flower Games ${currency.toUpperCase()} Losses`;
        break;
      case "games":
        sortField = `${timeframe}.flowerGamesPlayed`;
        displayField = "flowerGamesPlayed";
        title = `Most Flower Games Played (${currency.toUpperCase()})`;
        break;
      default:
        sortField = `${timeframe}.flower${
          currency.charAt(0).toUpperCase() + currency.slice(1)
        }Wagered`;
        displayField = `flower${
          currency.charAt(0).toUpperCase() + currency.slice(1)
        }Wagered`;
        title = `Top Flower Games ${currency.toUpperCase()} Wagered`;
    }

    // Get leaderboard stats
    const { stats, totalCount } = await getLeaderboardStats(
      timeframe,
      sortField,
      sortDirection,
      skip,
      limit
    );

    if (stats.length === 0) {
      return interaction.editReply(
        "No data found for this flower games leaderboard."
      );
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(0x4caf50) // Green color for flower games
      .setTitle(
        `${EMOJIS.cards} ${title} (${
          timeframe === "allTime" ? "All Time" : timeframe
        })`
      )
      .setDescription(`Page ${page} of ${Math.ceil(totalCount / limit)}`)
      .setTimestamp();

    // Format leaderboard text
    const leaderboardText = stats
      .map((stat, index) => {
        const position = skip + index + 1;
        let value;

        if (category === "games") {
          value = stat[timeframe][displayField] || 0;
        } else {
          value = BigInt(stat[timeframe][displayField] || "0");
          if (category === "losses" && value < 0n) {
            value = -value; // Make losses positive for display
          }
        }

        return `${position}. <@${stat.userId}> - **${
          category === "games" ? value : formatAmount(value)
        }**`;
      })
      .join("\n");

    embed.addFields({ name: "Leaderboard", value: leaderboardText });

    await interaction.editReply({ embeds: [embed] });
  }, "FlowerLeaderboardCommand"),

  // For prefix command usage
  async run(message, args) {
    try {
      // Parse arguments
      let currency = "osrs";
      let timeframe = "allTime";
      let category = "wagered";
      let limit = 10;
      let page = 1;

      // Process args
      if (args.length > 0) {
        // First arg could be currency
        const firstArg = args[0].toLowerCase();
        if (["osrs", "osrs", "rs3"].includes(firstArg)) {
          currency = firstArg === "osrs" ? "osrs" : firstArg;
          args.shift();
        }

        // Next arg could be timeframe
        if (args.length > 0) {
          const timeframeArg = args[0].toLowerCase();
          if (
            ["alltime", "daily", "weekly", "monthly"].includes(timeframeArg)
          ) {
            timeframe = timeframeArg === "alltime" ? "allTime" : timeframeArg;
            args.shift();
          }
        }

        // Next arg could be category
        if (args.length > 0) {
          const categoryArg = args[0].toLowerCase();
          if (["profit", "wagered", "losses", "games"].includes(categoryArg)) {
            category = categoryArg;
            args.shift();
          }
        }

        // Check for limit and page
        for (let i = 0; i < args.length; i++) {
          if (args[i].toLowerCase() === "limit" && i + 1 < args.length) {
            limit = parseInt(args[i + 1]) || 10;
            limit = Math.min(Math.max(limit, 1), 25); // Clamp between 1 and 25
          }
          if (args[i].toLowerCase() === "page" && i + 1 < args.length) {
            page = parseInt(args[i + 1]) || 1;
            page = Math.max(page, 1); // Ensure page is at least 1
          }
        }
      }

      const skip = (page - 1) * limit;

      let sortField,
        sortDirection = -1,
        displayField,
        title;

      // Determine sort field and display field based on category and currency
      switch (category) {
        case "profit":
          sortField = `${timeframe}.flower${
            currency.charAt(0).toUpperCase() + currency.slice(1)
          }Profit`;
          displayField = `flower${
            currency.charAt(0).toUpperCase() + currency.slice(1)
          }Profit`;
          title = `Top Flower Games ${currency.toUpperCase()} Profit`;
          break;
        case "wagered":
          sortField = `${timeframe}.flower${
            currency.charAt(0).toUpperCase() + currency.slice(1)
          }Wagered`;
          displayField = `flower${
            currency.charAt(0).toUpperCase() + currency.slice(1)
          }Wagered`;
          title = `Top Flower Games ${currency.toUpperCase()} Wagered`;
          break;
        case "losses":
          sortField = `${timeframe}.flower${
            currency.charAt(0).toUpperCase() + currency.slice(1)
          }Profit`;
          sortDirection = 1; // Ascending for losses
          displayField = `flower${
            currency.charAt(0).toUpperCase() + currency.slice(1)
          }Profit`;
          title = `Top Flower Games ${currency.toUpperCase()} Losses`;
          break;
        case "games":
          sortField = `${timeframe}.flowerGamesPlayed`;
          displayField = "flowerGamesPlayed";
          title = `Most Flower Games Played (${currency.toUpperCase()})`;
          break;
        default:
          sortField = `${timeframe}.flower${
            currency.charAt(0).toUpperCase() + currency.slice(1)
          }Wagered`;
          displayField = `flower${
            currency.charAt(0).toUpperCase() + currency.slice(1)
          }Wagered`;
          title = `Top Flower Games ${currency.toUpperCase()} Wagered`;
      }

      // Get leaderboard stats
      const { stats, totalCount } = await getLeaderboardStats(
        timeframe,
        sortField,
        sortDirection,
        skip,
        limit
      );

      if (stats.length === 0) {
        return message.reply(
          "No data found for this flower games leaderboard."
        );
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(0x4caf50) // Green color for flower games
        .setTitle(
          `${EMOJIS.cards} ${title} (${
            timeframe === "allTime" ? "All Time" : timeframe
          })`
        )
        .setDescription(`Page ${page} of ${Math.ceil(totalCount / limit)}`)
        .setTimestamp();

      // Format leaderboard text
      const leaderboardText = stats
        .map((stat, index) => {
          const position = skip + index + 1;
          let value;

          if (category === "games") {
            value = stat[timeframe][displayField] || 0;
          } else {
            value = BigInt(stat[timeframe][displayField] || "0");
            if (category === "losses" && value < 0n) {
              value = -value; // Make losses positive for display
            }
          }

          return `${position}. <@${stat.userId}> - **${
            category === "games" ? value : formatAmount(value)
          }**`;
        })
        .join("\n");

      embed.addFields({ name: "Leaderboard", value: leaderboardText });

      await message.reply({ embeds: [embed] });
    } catch (error) {
      logger.error(
        "FlowerLeaderboard",
        "Error in !flower-leaderboard command",
        error
      );
      await message.reply(
        "❌ An error occurred while fetching the flower games leaderboard."
      );
    }
  },

  // Command aliases
  aliases: ["flb", "flowerlb"],
};
