// commands/leaderboard-07.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getLeaderboardStats } = require("../utils/PlayerStatsManager");
const { formatAmount, EMOJIS } = require("../utils/embedcreator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard-07")
    .setDescription("View the osrs leaderboard.")
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
          { name: "Donations", value: "donations" }
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

      const timeframe = interaction.options.getString("timeframe") || "allTime";
      const category = interaction.options.getString("category") || "wagered"; // Default to wagered
      const limit = interaction.options.getInteger("limit") || 10;
      const page = interaction.options.getInteger("page") || 1;
      const skip = (page - 1) * limit;
      const currency = "osrs";

      let sortField,
        sortDirection = -1,
        displayField,
        title;

      switch (category) {
        case "profit":
          sortField = `${timeframe}.osrsProfit`;
          displayField = "osrsProfit";
          title = "Top osrs Profit";
          break;
        case "wagered":
          sortField = `${timeframe}.osrsWagered`;
          displayField = "osrsWagered";
          title = "Top osrs Wagered";
          break;
        case "losses":
          sortField = `${timeframe}.osrsProfit`;
          sortDirection = 1; // Ascending for losses
          displayField = "osrsProfit";
          title = "Top osrs Losses";
          break;
        case "bets":
          sortField = `${timeframe}.betsWon`;
          displayField = "betsWon";
          title = "Most osrs Bets";
          break;
        case "donations":
          sortField = `${timeframe}.osrsDonated`;
          displayField = "osrsDonated";
          title = "Top osrs Donators";
          break;
        default:
          return interaction.editReply("Invalid category.");
      }

      // Use the new function that excludes hosts
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

      const embed = new EmbedBuilder()
        .setColor(0xdaa520)
        .setTitle(
          `${EMOJIS.stash} ${title} (${
            timeframe === "allTime" ? "All Time" : timeframe
          })`
        )
        .setDescription(`Page ${page} of ${Math.ceil(totalCount / limit)}`)
        .setTimestamp();

      const leaderboardText = stats
        .map((stat, index) => {
          const position = skip + index + 1;
          let value;

          if (category === "bets") {
            value = stat[timeframe].betsWon + stat[timeframe].betsLost;
          } else {
            value = BigInt(stat[timeframe][displayField] || "0");
            if (category === "losses" && value < 0n) {
              value = -value; // Make losses positive for display
            }
          }

          return `${position}. <@${stat.userId}> - **${
            category === "bets" ? value : formatAmount(value)
          }**`;
        })
        .join("\n");

      embed.addFields({ name: "Leaderboard", value: leaderboardText });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in /leaderboard-07 command:", error);
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: "❌ An error occurred while fetching the leaderboard.",
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      // Parse arguments
      let timeframe = "allTime";
      let category = "wagered";
      let limit = 10;
      let page = 1;

      // Process args
      if (args.length > 0) {
        // First arg could be timeframe or category
        const firstArg = args[0].toLowerCase();
        if (["alltime", "daily", "weekly", "monthly"].includes(firstArg)) {
          timeframe = firstArg === "alltime" ? "allTime" : firstArg;
          if (args.length > 1) {
            category = args[1].toLowerCase();
          }
        } else {
          category = firstArg;
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
      const currency = "osrs";

      // Validate category
      if (
        !["profit", "wagered", "losses", "bets", "donations"].includes(category)
      ) {
        category = "wagered"; // Default to wagered if invalid
      }

      let sortField,
        sortDirection = -1,
        displayField,
        title;

      switch (category) {
        case "profit":
          sortField = `${timeframe}.osrsProfit`;
          displayField = "osrsProfit";
          title = "Top osrs Profit";
          break;
        case "wagered":
          sortField = `${timeframe}.osrsWagered`;
          displayField = "osrsWagered";
          title = "Top osrs Wagered";
          break;
        case "losses":
          sortField = `${timeframe}.osrsProfit`;
          sortDirection = 1; // Ascending for losses
          displayField = "osrsProfit";
          title = "Top osrs Losses";
          break;
        case "bets":
          sortField = `${timeframe}.betsWon`;
          displayField = "betsWon";
          title = "Most osrs Bets";
          break;
        case "donations":
          sortField = `${timeframe}.osrsDonated`;
          displayField = "osrsDonated";
          title = "Top osrs Donators";
          break;
      }

      // Use the new function that excludes hosts
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

      const embed = new EmbedBuilder()
        .setColor(0xdaa520)
        .setTitle(
          `${EMOJIS.stash} ${title} (${
            timeframe === "allTime" ? "All Time" : timeframe
          })`
        )
        .setDescription(`Page ${page} of ${Math.ceil(totalCount / limit)}`)
        .setTimestamp();

      const leaderboardText = stats
        .map((stat, index) => {
          const position = skip + index + 1;
          let value;

          if (category === "bets") {
            value = stat[timeframe].betsWon + stat[timeframe].betsLost;
          } else {
            value = BigInt(stat[timeframe][displayField] || "0");
            if (category === "losses" && value < 0n) {
              value = -value; // Make losses positive for display
            }
          }

          return `${position}. <@${stat.userId}> - **${
            category === "bets" ? value : formatAmount(value)
          }**`;
        })
        .join("\n");

      embed.addFields({ name: "Leaderboard", value: leaderboardText });

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in !leaderboard-07 command:", error);
      await message.reply(
        "❌ An error occurred while fetching the leaderboard."
      );
    }
  },
};
// This command retrieves and displays the osrs leaderboard for various categories and timeframes.
// This module defines the osrs leaderboards command for Discord.
// It allows users to view leaderboards for various categories and timeframes.
