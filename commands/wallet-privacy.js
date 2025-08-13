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
        .setDescription("Set your wallet to private or public.")
        .setRequired(true)
        .addChoices(
          { name: "On (Private - Only visible to you)", value: "on" },
          { name: "Off (Public - Visible to everyone)", value: "off" }
        )
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const status = interaction.options.getString("status");
      console.log(
        `[EXECUTE] /wallet-privacy set to ${status} by ${interaction.user.tag}`
      );

      const isPrivate = status === "on";
      const wallet = await getWallet(interaction.user.id);

      if (wallet.isPrivate === isPrivate) {
        return interaction.editReply({
          content: `Your wallet privacy is already turned **${status}**.`,
        });
      }

      wallet.isPrivate = isPrivate;
      await updateWallet(interaction.user.id, wallet);

      const privacyExplanation = isPrivate
        ? "Your wallet will now be shown only to you (as ephemeral messages in channels and DMs for prefix commands)."
        : "Your wallet will now be visible to everyone in the channel.";

      await interaction.editReply({
        content: `${EMOJIS.win} Your wallet privacy has been turned **${status}**.\n\n${privacyExplanation}`,
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
          "❌ Please specify a privacy setting. Usage: `!wallet-privacy <on/off>`"
        );
      }

      const statusInput = args[0].toLowerCase();
      let status;

      if (
        statusInput === "on" ||
        statusInput === "private" ||
        statusInput === "p"
      ) {
        status = "on";
      } else if (
        statusInput === "off" ||
        statusInput === "public" ||
        statusInput === "pub"
      ) {
        status = "off";
      } else {
        return message.reply(
          "❌ Invalid privacy setting. Please use 'on' or 'off'."
        );
      }

      console.log(
        `[RUN] !wallet-privacy set to ${status} by ${message.author.tag}`
      );

      const isPrivate = status === "on";
      const wallet = await getWallet(message.author.id);

      if (wallet.isPrivate === isPrivate) {
        return message.reply({
          content: `Your wallet privacy is already turned **${status}**.`,
        });
      }

      wallet.isPrivate = isPrivate;
      await updateWallet(message.author.id, wallet);

      const privacyExplanation = isPrivate
        ? "Your wallet will now be shown only to you (sent to your DMs when using prefix commands)."
        : "Your wallet will now be visible to everyone in the channel.";

      await message.reply({
        content: `${EMOJIS.win} Your wallet privacy has been turned **${status}**.\n\n${privacyExplanation}`,
      });
    } catch (error) {
      console.error("Error in !wallet-privacy command:", error);
      await message.reply(
        "❌ An error occurred while updating your privacy settings."
      );
    }
  },

  // Command aliases
  aliases: ["wp", "privacy"],
};
