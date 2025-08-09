// commands/daily.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getAndResetStats } = require("../utils/PlayerStatsManager");
const { EMOJIS, formatAmount } = require("../utils/embedcreator");

const createStatsField = (statsBlock) => {
  if (!statsBlock) return "`No activity recorded.`";
  const totalBets = (statsBlock.betsWon || 0) + (statsBlock.betsLost || 0);
  if (totalBets === 0) return "`No activity today.`";

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
    .setName("daily")
    .setDescription(
      "View your betting statistics for today (resets 00:00 UTC)."
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      console.log(`[EXECUTE] /daily by ${interaction.user.tag}`);

      const playerStats = await getAndResetStats(interaction.user.id);
      if (!playerStats) {
        return interaction.editReply({
          content: "❌ Stats system is unavailable (no DB connection).",
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x800000)
        .setTitle(`${EMOJIS.skull} Today's Action`)
        .setDescription(
          `*${interaction.user.username}'s record since the last reset.*`
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields({
          name: "Daily Record",
          value: createStatsField(playerStats.daily),
        });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in /daily command:", error);
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: "❌ The daily report is missing.",
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      console.log(`[RUN] !daily by ${message.author.tag}`);

      const playerStats = await getAndResetStats(message.author.id);
      if (!playerStats) {
        return message.reply(
          "❌ Stats system is unavailable (no DB connection)."
        );
      }

      const embed = new EmbedBuilder()
        .setColor(0x800000)
        .setTitle(`${EMOJIS.skull} Today's Action`)
        .setDescription(
          `*${message.author.username}'s record since the last reset.*`
        )
        .setThumbnail(message.author.displayAvatarURL())
        .addFields({
          name: "Daily Record",
          value: createStatsField(playerStats.daily),
        });

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in !daily command:", error);
      await message.reply("❌ The daily report is missing.");
    }
  },
};

// This command allows users to view their betting statistics for today.
// It fetches the user's daily stats from the database, formats them, and sends an embed
