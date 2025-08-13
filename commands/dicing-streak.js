// commands/dicing-streak.js
const { SlashCommandBuilder } = require("discord.js");
const { getPlayerStats } = require("../utils/PlayerStatsManager");
const { formatAmount } = require("../utils/embedcreator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dicing-streak")
    .setDescription("View your current dicing streak and stats"),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const userId = interaction.user.id;
      const stats = await getPlayerStats(userId);

      // Calculate win rate
      const totalGames = stats.gamesWon + stats.gamesLost;
      const winRate =
        totalGames > 0 ? ((stats.gamesWon / totalGames) * 100).toFixed(2) : 0;

      // Format amounts
      const osrsWagered = formatAmount(stats.osrsWagered || "0");
      const osrsWon = formatAmount(stats.osrsWon || "0");
      const osrsLost = formatAmount(stats.osrsLost || "0");
      const rs3Wagered = formatAmount(stats.rs3Wagered || "0");
      const rs3Won = formatAmount(stats.rs3Won || "0");
      const rs3Lost = formatAmount(stats.rs3Lost || "0");

      // Create embed
      const embed = {
        color: 0x3498db,
        title: `${interaction.user.username}'s Dicing Stats`,
        thumbnail: {
          url: interaction.user.displayAvatarURL({ dynamic: true }),
        },
        fields: [
          {
            name: "🎲 Games",
            value: `Played: ${totalGames}\nWon: ${stats.gamesWon}\nLost: ${stats.gamesLost}\nWin Rate: ${winRate}%`,
            inline: true,
          },
          {
            name: "💰 osrs",
            value: `Wagered: ${osrsWagered}\nWon: ${osrsWon}\nLost: ${osrsLost}`,
            inline: true,
          },
          {
            name: "💰 RS3",
            value: `Wagered: ${rs3Wagered}\nWon: ${rs3Won}\nLost: ${rs3Lost}`,
            inline: true,
          },
        ],
        footer: {
          text: "Use !dice <amount> to play",
        },
        timestamp: new Date(),
      };

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in dicing-streak command:", error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: "❌ An error occurred while retrieving your dicing stats.",
        });
      } else {
        await interaction.reply({
          content: "❌ An error occurred while retrieving your dicing stats.",
          ephemeral: true,
        });
      }
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      const userId = message.author.id;
      const stats = await getPlayerStats(userId);

      // Calculate win rate
      const totalGames = stats.gamesWon + stats.gamesLost;
      const winRate =
        totalGames > 0 ? ((stats.gamesWon / totalGames) * 100).toFixed(2) : 0;

      // Format amounts
      const osrsWagered = formatAmount(stats.osrsWagered || "0");
      const osrsWon = formatAmount(stats.osrsWon || "0");
      const osrsLost = formatAmount(stats.osrsLost || "0");
      const rs3Wagered = formatAmount(stats.rs3Wagered || "0");
      const rs3Won = formatAmount(stats.rs3Won || "0");
      const rs3Lost = formatAmount(stats.rs3Lost || "0");

      // Create embed
      const embed = {
        color: 0x3498db,
        title: `${message.author.username}'s Dicing Stats`,
        thumbnail: {
          url: message.author.displayAvatarURL({ dynamic: true }),
        },
        fields: [
          {
            name: "🎲 Games",
            value: `Played: ${totalGames}\nWon: ${stats.gamesWon}\nLost: ${stats.gamesLost}\nWin Rate: ${winRate}%`,
            inline: true,
          },
          {
            name: "💰 osrs",
            value: `Wagered: ${osrsWagered}\nWon: ${osrsWon}\nLost: ${osrsLost}`,
            inline: true,
          },
          {
            name: "💰 RS3",
            value: `Wagered: ${rs3Wagered}\nWon: ${rs3Won}\nLost: ${rs3Lost}`,
            inline: true,
          },
        ],
        footer: {
          text: "Use !dice <amount> to play",
        },
        timestamp: new Date(),
      };

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in dicing-streak command:", error);
      await message.reply(
        "❌ An error occurred while retrieving your dicing stats."
      );
    }
  },
};
