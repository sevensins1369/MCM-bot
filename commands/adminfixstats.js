// commands/adminfixstats.js
const { SlashCommandBuilder } = require("discord.js");
const { getPlayerStats } = require("../utils/PlayerStatsManager");
const fs = require("fs");
const path = require("path");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("adminfixstats")
    .setDescription("Admin command to fix duel stats")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to fix stats for")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("wins")
        .setDescription("Set number of duel wins")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("losses")
        .setDescription("Set number of duel losses")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      // Check if user is admin
      if (!interaction.member.permissions.has("Administrator")) {
        return interaction.reply({
          content: "❌ Only administrators can use this command.",
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const targetUser = interaction.options.getUser("user");
      const wins = interaction.options.getInteger("wins");
      const losses = interaction.options.getInteger("losses");

      // Get current stats
      const playerStats = await getPlayerStats(targetUser.id);

      // Update duel stats
      playerStats.duelsWon = wins;
      playerStats.duelsLost = losses;
      playerStats.updatedAt = new Date();

      // Update the cache
      const { statsCache } = require("../utils/PlayerStatsManager");
      statsCache.set(targetUser.id, playerStats);

      // Save to file
      const STATS_FILE = path.join(__dirname, "/container/data/playerstats.json");
      if (fs.existsSync(STATS_FILE)) {
        const data = fs.readFileSync(STATS_FILE, "utf8");
        const stats = JSON.parse(data);

        if (!stats[targetUser.id]) {
          stats[targetUser.id] = playerStats;
        } else {
          stats[targetUser.id].duelsWon = wins;
          stats[targetUser.id].duelsLost = losses;
          stats[targetUser.id].updatedAt = new Date();
        }

        fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
      }

      await interaction.editReply({
        content: `✅ Duel stats for ${targetUser.username} have been updated to ${wins} wins and ${losses} losses.`,
      });
    } catch (error) {
      console.error("Error in adminfixstats command:", error);
      await interaction.reply({
        content: "❌ An error occurred while fixing duel stats.",
        ephemeral: true,
      });
    }
  },

  async run(message, args) {
    try {
      // Check if user is admin
      if (!message.member.permissions.has("Administrator")) {
        return message.reply("❌ Only administrators can use this command.");
      }

      if (args.length < 3) {
        return message.reply(
          "❌ Usage: !adminfixstats <@user> <wins> <losses>"
        );
      }

      const userMention = args[0];
      const userId = userMention.replace(/[<@!>]/g, "");
      const targetUser = await message.client.users
        .fetch(userId)
        .catch(() => null);

      if (!targetUser) {
        return message.reply("❌ Invalid user. Please mention a valid user.");
      }

      const wins = parseInt(args[1]);
      const losses = parseInt(args[2]);

      if (isNaN(wins) || isNaN(losses)) {
        return message.reply("❌ Wins and losses must be valid numbers.");
      }

      // Get current stats
      const playerStats = await getPlayerStats(targetUser.id);

      // Update duel stats
      playerStats.duelsWon = wins;
      playerStats.duelsLost = losses;
      playerStats.updatedAt = new Date();

      // Update the cache
      const { statsCache } = require("../utils/PlayerStatsManager");
      statsCache.set(targetUser.id, playerStats);

      // Save to file
      const STATS_FILE = path.join(__dirname, "/container/data/playerStats.json");
      if (fs.existsSync(STATS_FILE)) {
        const data = fs.readFileSync(STATS_FILE, "utf8");
        const stats = JSON.parse(data);

        if (!stats[targetUser.id]) {
          stats[targetUser.id] = playerStats;
        } else {
          stats[targetUser.id].duelsWon = wins;
          stats[targetUser.id].duelsLost = losses;
          stats[targetUser.id].updatedAt = new Date();
        }

        fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
      }

      await message.reply({
        content: `✅ Duel stats for ${targetUser.username} have been updated to ${wins} wins and ${losses} losses.`,
      });
    } catch (error) {
      console.error("Error in !adminfixstats command:", error);
      await message.reply("❌ An error occurred while fixing duel stats.");
    }
  },

  aliases: ["afs"],
};
