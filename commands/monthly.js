// commands/monthly.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getAndResetStats } = require("../utils/PlayerStatsManager");
const { EMOJIS, formatAmount } = require("../utils/embedcreator");

const createStatsField = (statsBlock) => {
  if (!statsBlock) return "`No activity recorded.`";
  const totalBets = (statsBlock.betsWon || 0) + (statsBlock.betsLost || 0);
  if (totalBets === 0) return "`No activity this month.`";

  const winRate = ((statsBlock.betsWon || 0) / totalBets) * 100;
  const profit = (statsBlock.osrsProfit || 0) + (statsBlock.rs3Profit || 0);

  return `**Wins:** \`${statsBlock.betsWon}\` | **Losses:** \`${
    statsBlock.betsLost
  }\`\n**Win Rate:** \`${winRate.toFixed(
    1
  )}%\`\n**Net Profit:** \`${formatAmount(profit)}\``;
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("monthly")
    .setDescription(
      "View your betting statistics for this month (resets on the 1st of the month 00:00 UTC)."
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      console.log(`[EXECUTE] /monthly by ${interaction.user.tag}`);

      const playerStats = await getAndResetStats(interaction.user.id);
      if (!playerStats) {
        return interaction.editReply({
          content: "❌ Stats system is unavailable (no DB connection).",
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x1565c0)
        .setTitle(`${EMOJIS.diamond} This Month's Take`)
        .setDescription(
          `*${interaction.user.username}'s record since the start of the month.*`
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields({
          name: "Monthly Record",
          value: createStatsField(playerStats.monthly),
        });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in /monthly command:", error);
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: "❌ The monthly report is missing.",
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      console.log(`[RUN] !monthly by ${message.author.tag}`);

      const playerStats = await getAndResetStats(message.author.id);
      if (!playerStats) {
        return message.reply(
          "❌ Stats system is unavailable (no DB connection)."
        );
      }

      const embed = new EmbedBuilder()
        .setColor(0x1565c0)
        .setTitle(`${EMOJIS.diamond} This Month's Take`)
        .setDescription(
          `*${message.author.username}'s record since the start of the month.*`
        )
        .setThumbnail(message.author.displayAvatarURL())
        .addFields({
          name: "Monthly Record",
          value: createStatsField(playerStats.monthly),
        });

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in !monthly command:", error);
      await message.reply("❌ The monthly report is missing.");
    }
  },
};

// This command allows users to view their betting statistics for the current month.
// It fetches the user's monthly stats from the database, formats them, and sends an embed
