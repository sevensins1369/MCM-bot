// commands/resetduel.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getPlayerStats } = require("../utils/PlayerStatsManager");
const fs = require("fs");
const path = require("path");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("resetduel")
    .setDescription("Reset your duel streak for a fresh session (Host only)"),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const user = interaction.user;
      const isHost = interaction.member.roles.cache.has(
        process.env.HOST_ROLE_ID
      );
      const isAdmin = interaction.member.permissions.has("Administrator");

      if (!isHost && !isAdmin) {
        return interaction.editReply({
          content:
            "❌ You do not have permission to use this command. Only hosts can reset their duel streak.",
        });
      }

      // Get current stats
      const playerStats = await getPlayerStats(user.id);

      // Store the old stats for the confirmation message
      const oldWins = playerStats.duelsWon || 0;
      const oldLosses = playerStats.duelsLost || 0;
      const totalDuels = oldWins + oldLosses;
      const winRate =
        totalDuels > 0 ? ((oldWins / totalDuels) * 100).toFixed(1) : 0;

      // Reset duel stats
      playerStats.duelsWon = 0;
      playerStats.duelsLost = 0;
      // Keep duelsHosted as is, since that's a cumulative stat

      // Update the cache
      const { statsCache } = require("../utils/PlayerStatsManager");
      statsCache.set(user.id, playerStats);

      // Save to storage
      const { saveStats } = require("../utils/PlayerStatsManager");
      saveStats();

      // Clear duel history from cache
      const { duelHistoryCache } = require("../utils/PlayerStatsManager");
      if (duelHistoryCache && duelHistoryCache.has(user.id)) {
        duelHistoryCache.set(user.id, []);
      }

      // Also clear duel history from file
      const DUEL_HISTORY_FILE = path.join(
        __dirname,
        "../data/duelHistory.json"
      );
      if (fs.existsSync(DUEL_HISTORY_FILE)) {
        try {
          const data = fs.readFileSync(DUEL_HISTORY_FILE, "utf8");
          const history = JSON.parse(data);

          if (history[user.id]) {
            history[user.id] = []; // Clear the user's duel history
            fs.writeFileSync(
              DUEL_HISTORY_FILE,
              JSON.stringify(history, null, 2)
            );
          }
        } catch (error) {
          console.error("Error clearing duel history:", error);
        }
      }

      // If using MongoDB, update there too
      if (require("../utils/database").isUsingMongoDB()) {
        try {
          const PlayerStats = require("../models/PlayerStats");
          if (PlayerStats) {
            await PlayerStats.updateOne(
              { userId: user.id },
              {
                $set: {
                  duelsWon: 0,
                  duelsLost: 0,
                  duelHistory: [],
                  updatedAt: new Date(),
                },
              },
              { upsert: true }
            );
          }
        } catch (error) {
          console.error(
            `Error updating stats in MongoDB for user ${user.id}:`,
            error
          );
        }
      }

      // Create confirmation embed
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("Duel Streak Reset")
        .setDescription(`Your duel streak has been reset for a fresh session.`)
        .addFields(
          {
            name: "Previous Stats",
            value: `Wins: ${oldWins}\nLosses: ${oldLosses}\nTotal Duels: ${totalDuels}\nWin Rate: ${winRate}%`,
            inline: true,
          },
          {
            name: "New Stats",
            value: "Wins: 0\nLosses: 0\nTotal Duels: 0\nWin Rate: 0%",
            inline: true,
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      console.log(
        `${user.username} reset their duel streak. Previous stats: ${oldWins} wins, ${oldLosses} losses`
      );
    } catch (error) {
      console.error("Error in /resetduel command:", error);
      await interaction.editReply({
        content: `❌ An error occurred: ${error.message}`,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      const user = message.author;
      const isHost = message.member.roles.cache.has(process.env.HOST_ROLE_ID);
      const isAdmin = message.member.permissions.has("Administrator");

      if (!isHost && !isAdmin) {
        return message.reply(
          "❌ You do not have permission to use this command. Only hosts can reset their duel streak."
        );
      }

      // Get current stats
      const playerStats = await getPlayerStats(user.id);

      // Store the old stats for the confirmation message
      const oldWins = playerStats.duelsWon || 0;
      const oldLosses = playerStats.duelsLost || 0;
      const totalDuels = oldWins + oldLosses;
      const winRate =
        totalDuels > 0 ? ((oldWins / totalDuels) * 100).toFixed(1) : 0;

      // Reset duel stats
      playerStats.duelsWon = 0;
      playerStats.duelsLost = 0;
      // Keep duelsHosted as is, since that's a cumulative stat

      // Update the cache
      const { statsCache } = require("../utils/PlayerStatsManager");
      statsCache.set(user.id, playerStats);

      // Save to storage
      const { saveStats } = require("../utils/PlayerStatsManager");
      saveStats();

      // Clear duel history from cache
      const { duelHistoryCache } = require("../utils/PlayerStatsManager");
      if (duelHistoryCache && duelHistoryCache.has(user.id)) {
        duelHistoryCache.set(user.id, []);
      }

      // Also clear duel history from file
      const DUEL_HISTORY_FILE = path.join(
        __dirname,
        "../data/duelHistory.json"
      );
      if (fs.existsSync(DUEL_HISTORY_FILE)) {
        try {
          const data = fs.readFileSync(DUEL_HISTORY_FILE, "utf8");
          const history = JSON.parse(data);

          if (history[user.id]) {
            history[user.id] = []; // Clear the user's duel history
            fs.writeFileSync(
              DUEL_HISTORY_FILE,
              JSON.stringify(history, null, 2)
            );
          }
        } catch (error) {
          console.error("Error clearing duel history:", error);
        }
      }

      // If using MongoDB, update there too
      if (require("../utils/database").isUsingMongoDB()) {
        try {
          const PlayerStats = require("../models/PlayerStats");
          if (PlayerStats) {
            await PlayerStats.updateOne(
              { userId: user.id },
              {
                $set: {
                  duelsWon: 0,
                  duelsLost: 0,
                  duelHistory: [],
                  updatedAt: new Date(),
                },
              },
              { upsert: true }
            );
          }
        } catch (error) {
          console.error(
            `Error updating stats in MongoDB for user ${user.id}:`,
            error
          );
        }
      }

      // Create confirmation embed
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("Duel Streak Reset")
        .setDescription(`Your duel streak has been reset for a fresh session.`)
        .addFields(
          {
            name: "Previous Stats",
            value: `Wins: ${oldWins}\nLosses: ${oldLosses}\nTotal Duels: ${totalDuels}\nWin Rate: ${winRate}%`,
            inline: true,
          },
          {
            name: "New Stats",
            value: "Wins: 0\nLosses: 0\nTotal Duels: 0\nWin Rate: 0%",
            inline: true,
          }
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });

      console.log(
        `${user.username} reset their duel streak. Previous stats: ${oldWins} wins, ${oldLosses} losses`
      );
    } catch (error) {
      console.error("Error in !resetduel command:", error);
      await message.reply(`❌ An error occurred: ${error.message}`);
    }
  },

  // Command aliases
  aliases: ["rd", "resetstreak"],
};
