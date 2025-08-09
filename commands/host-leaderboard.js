// commands/host-leaderboard.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const PlayerStats = require("../models/PlayerStats");
const { formatAmount, EMOJIS } = require("../utils/embedcreator");
const {
  updateHostLeaderboard,
  getHostLeaderboard,
} = require("../utils/LeaderboardManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("host-leaderboard")
    .setDescription("View the host leaderboard.")
    .addStringOption((option) =>
      option
        .setName("currency")
        .setDescription("The currency to view.")
        .setRequired(true)
        .addChoices(
          { name: "07", value: "osrs" },
          { name: "RS3", value: "rs3" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("category")
        .setDescription("The category to rank by.")
        .setRequired(true)
        .addChoices(
          { name: "Volume", value: "volume" },
          { name: "Win Rate", value: "winrate" },
          { name: "Total Bets", value: "bets" }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription("Number of hosts to show (default: 10).")
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
      const category = interaction.options.getString("category");
      const limit = interaction.options.getInteger("limit") || 10;
      const page = interaction.options.getInteger("page") || 1;
      const skip = (page - 1) * limit;

      // Get all users with the Host role
      const hostRole = await interaction.guild.roles.fetch(
        process.env.HOST_ROLE_ID
      );
      if (!hostRole) {
        return interaction.editReply(
          "❌ Host role not found. Please configure HOST_ROLE_ID in the environment variables."
        );
      }

      const hostMembers = hostRole.members.map((member) => member.id);

      // Find stats for hosts only
      const hostStats = await PlayerStats.find({
        userId: { $in: hostMembers },
      });

      if (hostStats.length === 0) {
        return interaction.editReply("No host statistics found.");
      }

      // Sort hosts based on category
      let sortedHosts = [];

      switch (category) {
        case "volume":
          sortedHosts = hostStats.sort((a, b) => {
            const aVolume = BigInt(a.allTime[`${currency}Wagered`] || "0");
            const bVolume = BigInt(b.allTime[`${currency}Wagered`] || "0");
            return bVolume > aVolume ? 1 : -1;
          });
          break;
        case "winrate":
          sortedHosts = hostStats.sort((a, b) => {
            const aTotal = a.allTime.betsWon + a.allTime.betsLost;
            const bTotal = b.allTime.betsWon + b.allTime.betsLost;
            const aRate = aTotal > 0 ? a.allTime.betsWon / aTotal : 0;
            const bRate = bTotal > 0 ? b.allTime.betsWon / bTotal : 0;
            return bRate - aRate;
          });
          break;
        case "bets":
          sortedHosts = hostStats.sort((a, b) => {
            const aTotal = a.allTime.betsWon + a.allTime.betsLost;
            const bTotal = b.allTime.betsWon + b.allTime.betsLost;
            return bTotal - aTotal;
          });
          break;
      }

      // Paginate
      const paginatedHosts = sortedHosts.slice(skip, skip + limit);

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(`${EMOJIS.host} Host Leaderboard - ${currency.toUpperCase()}`)
        .setDescription(
          `Page ${page} of ${Math.ceil(sortedHosts.length / limit)}`
        )
        .setTimestamp();

      const leaderboardText = await Promise.all(
        paginatedHosts.map(async (stat, index) => {
          const position = skip + index + 1;
          const user = await interaction.client.users
            .fetch(stat.userId)
            .catch(() => null);
          const username = user ? user.username : "Unknown User";

          let value;
          if (category === "volume") {
            value = formatAmount(
              BigInt(stat.allTime[`${currency}Wagered`] || "0")
            );
          } else if (category === "winrate") {
            const total = stat.allTime.betsWon + stat.allTime.betsLost;
            const rate =
              total > 0 ? Math.round((stat.allTime.betsWon / total) * 100) : 0;
            value = `${rate}%`;
          } else {
            // bets
            value = stat.allTime.betsWon + stat.allTime.betsLost;
          }

          return `${position}. ${username} - **${value}**`;
        })
      );

      embed.addFields({
        name: "Leaderboard",
        value: leaderboardText.join("\n") || "No data available",
      });

      // Save the leaderboard data to file
      const leaderboardData = paginatedHosts.map((stat, index) => {
        const position = skip + index + 1;
        let value;

        if (category === "volume") {
          value = BigInt(stat.allTime[`${currency}Wagered`] || "0").toString();
        } else if (category === "winrate") {
          const total = stat.allTime.betsWon + stat.allTime.betsLost;
          const rate =
            total > 0 ? Math.round((stat.allTime.betsWon / total) * 100) : 0;
          value = rate;
        } else {
          // bets
          value = stat.allTime.betsWon + stat.allTime.betsLost;
        }

        return {
          userId: stat.userId,
          position,
          value,
        };
      });

      await updateHostLeaderboard(currency, leaderboardData);

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in /host-leaderboard command:", error);
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: "❌ An error occurred while fetching the host leaderboard.",
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      if (args.length < 2) {
        return message.reply(
          "❌ Invalid command usage. Format: `!host-leaderboard <currency> <category> [limit] [page]`"
        );
      }

      const currency = args[0].toLowerCase();
      if (currency !== "osrs" && currency !== "rs3") {
        return message.reply("❌ Invalid currency. Must be 'osrs' or 'rs3'.");
      }

      const category = args[1].toLowerCase();
      if (!["volume", "winrate", "bets"].includes(category)) {
        return message.reply(
          "❌ Invalid category. Must be 'volume', 'winrate', or 'bets'."
        );
      }

      let limit = 10;
      let page = 1;

      // Check for limit and page
      for (let i = 2; i < args.length; i++) {
        if (args[i].toLowerCase() === "limit" && i + 1 < args.length) {
          limit = parseInt(args[i + 1]) || 10;
          limit = Math.min(Math.max(limit, 1), 25); // Clamp between 1 and 25
        }
        if (args[i].toLowerCase() === "page" && i + 1 < args.length) {
          page = parseInt(args[i + 1]) || 1;
          page = Math.max(page, 1); // Ensure page is at least 1
        }
      }

      const skip = (page - 1) * limit;

      // Get all users with the Host role
      const hostRole = await message.guild.roles.fetch(
        process.env.HOST_ROLE_ID
      );
      if (!hostRole) {
        return message.reply(
          "❌ Host role not found. Please configure HOST_ROLE_ID in the environment variables."
        );
      }

      const hostMembers = hostRole.members.map((member) => member.id);

      // Find stats for hosts only
      const hostStats = await PlayerStats.find({
        userId: { $in: hostMembers },
      });

      if (hostStats.length === 0) {
        return message.reply("No host statistics found.");
      }

      // Sort hosts based on category
      let sortedHosts = [];

      switch (category) {
        case "volume":
          sortedHosts = hostStats.sort((a, b) => {
            const aVolume = BigInt(a.allTime[`${currency}Wagered`] || "0");
            const bVolume = BigInt(b.allTime[`${currency}Wagered`] || "0");
            return bVolume > aVolume ? 1 : -1;
          });
          break;
        case "winrate":
          sortedHosts = hostStats.sort((a, b) => {
            const aTotal = a.allTime.betsWon + a.allTime.betsLost;
            const bTotal = b.allTime.betsWon + b.allTime.betsLost;
            const aRate = aTotal > 0 ? a.allTime.betsWon / aTotal : 0;
            const bRate = bTotal > 0 ? b.allTime.betsWon / bTotal : 0;
            return bRate - aRate;
          });
          break;
        case "bets":
          sortedHosts = hostStats.sort((a, b) => {
            const aTotal = a.allTime.betsWon + a.allTime.betsLost;
            const bTotal = b.allTime.betsWon + b.allTime.betsLost;
            return bTotal - aTotal;
          });
          break;
      }

      // Paginate
      const paginatedHosts = sortedHosts.slice(skip, skip + limit);

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(`${EMOJIS.host} Host Leaderboard - ${currency.toUpperCase()}`)
        .setDescription(
          `Page ${page} of ${Math.ceil(sortedHosts.length / limit)}`
        )
        .setTimestamp();

      const leaderboardText = await Promise.all(
        paginatedHosts.map(async (stat, index) => {
          const position = skip + index + 1;
          const user = await message.client.users
            .fetch(stat.userId)
            .catch(() => null);
          const username = user ? user.username : "Unknown User";

          let value;
          if (category === "volume") {
            value = formatAmount(
              BigInt(stat.allTime[`${currency}Wagered`] || "0")
            );
          } else if (category === "winrate") {
            const total = stat.allTime.betsWon + stat.allTime.betsLost;
            const rate =
              total > 0 ? Math.round((stat.allTime.betsWon / total) * 100) : 0;
            value = `${rate}%`;
          } else {
            // bets
            value = stat.allTime.betsWon + stat.allTime.betsLost;
          }

          return `${position}. ${username} - **${value}**`;
        })
      );

      embed.addFields({
        name: "Leaderboard",
        value: leaderboardText.join("\n") || "No data available",
      });

      // Save the leaderboard data to file
      const leaderboardData = paginatedHosts.map((stat, index) => {
        const position = skip + index + 1;
        let value;

        if (category === "volume") {
          value = BigInt(stat.allTime[`${currency}Wagered`] || "0").toString();
        } else if (category === "winrate") {
          const total = stat.allTime.betsWon + stat.allTime.betsLost;
          const rate =
            total > 0 ? Math.round((stat.allTime.betsWon / total) * 100) : 0;
          value = rate;
        } else {
          // bets
          value = stat.allTime.betsWon + stat.allTime.betsLost;
        }

        return {
          userId: stat.userId,
          position,
          value,
        };
      });

      await updateHostLeaderboard(currency, leaderboardData);

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in !host-leaderboard command:", error);
      await message.reply(
        "❌ An error occurred while fetching the host leaderboard."
      );
    }
  },
};
