// commands/duelstreak.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  getPlayerStats,
  getDuelHistory,
} = require("../utils/PlayerStatsManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("duelstreak")
    .setDescription("View a player's current duel streak and stats.")
    .addUserOption((option) =>
      option
        .setName("host")
        .setDescription("The host to check (defaults to you)")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      // Get the target user (either the specified user or the command user)
      const targetUser =
        interaction.options.getUser("host") || interaction.user;
      const userId = targetUser.id;

      // Fetch stats and history in parallel for efficiency
      const [stats, duelHistory] = await Promise.all([
        getPlayerStats(userId),
        getDuelHistory(userId, 15), // Get the last 15 duels for the streak display
      ]);

      // Calculate win rate and total duels
      const totalDuels = (stats.duelsWon || 0) + (stats.duelsLost || 0);
      const winRate =
        totalDuels > 0
          ? (((stats.duelsWon || 0) / totalDuels) * 100).toFixed(1)
          : 0;

      // Generate the emoji streak string
      const streakEmojis =
        duelHistory.length > 0
          ? duelHistory
              .map((duel) => (duel.result === "win" ? "✅" : "❌"))
              .join(" ")
          : "No recent duels recorded.";

      // Build the description string with the requested format
      const description = `**${stats.duelsWon || 0}** Wins / **${
        stats.duelsLost || 0
      }** Losses • **W/L:** ${winRate}% • **Total Duels:** ${totalDuels}\n\n${streakEmojis}`;

      // Create the simplified embed
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`${targetUser.username}'s Duel Streak`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setDescription(description)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in /duelstreak command:", error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: "❌ An error occurred while retrieving duel stats.",
        });
      } else {
        await interaction.reply({
          content: "❌ An error occurred while retrieving duel stats.",
          ephemeral: true,
        });
      }
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      // Get the target user (either the mentioned user or the command user)
      let targetUser = message.author;

      if (args.length > 0) {
        const userMention = args[0];
        const userId = userMention.replace(/[<@!>]/g, "");
        const mentionedUser = await message.client.users
          .fetch(userId)
          .catch(() => null);

        if (mentionedUser) {
          targetUser = mentionedUser;
        }
      }

      const userId = targetUser.id;

      // Fetch stats and history in parallel
      const [stats, duelHistory] = await Promise.all([
        getPlayerStats(userId),
        getDuelHistory(userId, 15),
      ]);

      // Calculate win rate and total duels
      const totalDuels = (stats.duelsWon || 0) + (stats.duelsLost || 0);
      const winRate =
        totalDuels > 0
          ? (((stats.duelsWon || 0) / totalDuels) * 100).toFixed(1)
          : 0;

      // Generate the emoji streak string
      const streakEmojis =
        duelHistory.length > 0
          ? duelHistory
              .map((duel) => (duel.result === "win" ? "✅" : "❌"))
              .join(" ")
          : "No recent duels recorded.";

      // Build the description string
      const description = `**${stats.duelsWon || 0}** Wins / **${
        stats.duelsLost || 0
      }** Losses • **W/L:** ${winRate}% • **Total Duels:** ${totalDuels}\n\n${streakEmojis}`;

      // Create the simplified embed
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`${targetUser.username}'s Duel Streak`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setDescription(description)
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in !duelstreak command:", error);
      await message.reply("❌ An error occurred while retrieving duel stats.");
    }
  },

  // Command aliases
  aliases: ["ds"],
};
