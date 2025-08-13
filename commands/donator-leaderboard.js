// commands/donator-leaderboard.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const PlayerStats = require("../models/PlayerStats");
const { formatAmount, EMOJIS } = require("../utils/embedcreator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("donator-leaderboard")
    .setDescription("Shows the top donators to the server wallet."),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const topOsrsDonators = await PlayerStats.find({
        "allTime.osrsDonated": { $ne: "0" },
      })
        .sort({ "allTime.osrsDonated": -1 })
        .limit(10);
      const topRs3Donators = await PlayerStats.find({
        "allTime.rs3Donated": { $ne: "0" },
      })
        .sort({ "allTime.rs3Donated": -1 })
        .limit(10);

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(`${EMOJIS.diamond} Top Donators`)
        .setDescription("A huge thank you to our most generous members!")
        .setTimestamp();

      let osrsText = topOsrsDonators
        .map((stat, index) => {
          return `${index + 1}. <@${stat.userId}> - **${formatAmount(
            BigInt(stat.allTime.osrsDonated)
          )}**`;
        })
        .join("\n");
      if (!osrsText) osrsText = "No osrs donations yet.";

      let rs3Text = topRs3Donators
        .map((stat, index) => {
          return `${index + 1}. <@${stat.userId}> - **${formatAmount(
            BigInt(stat.allTime.rs3Donated)
          )}**`;
        })
        .join("\n");
      if (!rs3Text) rs3Text = "No RS3 donations yet.";

      embed.addFields(
        { name: "Top osrs Donators", value: osrsText, inline: true },
        { name: "Top RS3 Donators", value: rs3Text, inline: true }
      );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in /donator-leaderboard command:", error);
      await interaction.editReply({
        content: "❌ An error occurred while fetching the leaderboard.",
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      const topOsrsDonators = await PlayerStats.find({
        "allTime.osrsDonated": { $ne: "0" },
      })
        .sort({ "allTime.osrsDonated": -1 })
        .limit(10);
      const topRs3Donators = await PlayerStats.find({
        "allTime.rs3Donated": { $ne: "0" },
      })
        .sort({ "allTime.rs3Donated": -1 })
        .limit(10);

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(`${EMOJIS.diamond} Top Donators`)
        .setDescription("A huge thank you to our most generous members!")
        .setTimestamp();

      let osrsText = topOsrsDonators
        .map((stat, index) => {
          return `${index + 1}. <@${stat.userId}> - **${formatAmount(
            BigInt(stat.allTime.osrsDonated)
          )}**`;
        })
        .join("\n");
      if (!osrsText) osrsText = "No osrs donations yet.";

      let rs3Text = topRs3Donators
        .map((stat, index) => {
          return `${index + 1}. <@${stat.userId}> - **${formatAmount(
            BigInt(stat.allTime.rs3Donated)
          )}**`;
        })
        .join("\n");
      if (!rs3Text) rs3Text = "No RS3 donations yet.";

      embed.addFields(
        { name: "Top osrs Donators", value: osrsText, inline: true },
        { name: "Top RS3 Donators", value: rs3Text, inline: true }
      );

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in !donator-leaderboard command:", error);
      await message.reply(
        "❌ An error occurred while fetching the leaderboard."
      );
    }
  },
};

// This command retrieves and displays the top donators to the server wallet for both osrs and RS3.
// It formats the data into an embed and sends it as a reply to the user.
