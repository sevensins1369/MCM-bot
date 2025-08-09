// commands/wallet-privacy.js
const { SlashCommandBuilder } = require("discord.js");
const { getWallet, updateWallet } = require("../utils/WalletManager");
const { EMOJIS } = require("../utils/embedcreator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wallet-privacy")
    .setDescription("Toggle your wallet's privacy setting.")
    .addStringOption((option) =>
      option
        .setName("status")
        .setDescription("Set your wallet to public or private.")
        .setRequired(true)
        .addChoices(
          { name: "Private (Hidden from others)", value: "private" },
          { name: "Public (Visible to others)", value: "public" }
        )
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const newStatus = interaction.options.getString("status");
      console.log(
        `[EXECUTE] /wallet-privacy set to ${newStatus} by ${interaction.user.tag}`
      );

      const isPrivate = newStatus === "private";
      const wallet = await getWallet(interaction.user.id);

      if (wallet.isPrivate === isPrivate) {
        return interaction.editReply({
          content: `Your wallet is already set to **${newStatus}**.`,
        });
      }

      wallet.isPrivate = isPrivate;
      await updateWallet(interaction.user.id, wallet);

      await interaction.editReply({
        content: `${EMOJIS.win} Your wallet privacy has been updated to **${newStatus}**.`,
      });
    } catch (error) {
      console.error("Error in /wallet-privacy command:", error);
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: "❌ An error occurred while updating your privacy settings.",
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      if (args.length < 1) {
        return message.reply(
          "❌ Please specify a privacy setting. Usage: `!wallet-privacy <public/private>`"
        );
      }

      const newStatusInput = args[0].toLowerCase();
      let newStatus;

      if (newStatusInput === "private" || newStatusInput === "p") {
        newStatus = "private";
      } else if (newStatusInput === "public" || newStatusInput === "pub") {
        newStatus = "public";
      } else {
        return message.reply(
          "❌ Invalid privacy setting. Please use 'public' or 'private'."
        );
      }

      console.log(
        `[RUN] !wallet-privacy set to ${newStatus} by ${message.author.tag}`
      );

      const isPrivate = newStatus === "private";
      const wallet = await getWallet(message.author.id);

      if (wallet.isPrivate === isPrivate) {
        return message.reply(`Your wallet is already set to **${newStatus}**.`);
      }

      wallet.isPrivate = isPrivate;
      await updateWallet(message.author.id, wallet);

      await message.reply(
        `${EMOJIS.win} Your wallet privacy has been updated to **${newStatus}**.`
      );
    } catch (error) {
      console.error("Error in !wallet-privacy command:", error);
      await message.reply(
        "❌ An error occurred while updating your privacy settings."
      );
    }
  },
};

// This command allows users to toggle the privacy of their wallet.
// It updates the user's wallet settings in the database and provides feedback on the change.
