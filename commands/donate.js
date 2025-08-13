// commands/donate.js
const { SlashCommandBuilder } = require("discord.js");
const parseAmount = require("../utils/parseAmount");
const { getWallet, updateWallet } = require("../utils/WalletManager");
const {
  getServerWallet,
  updateServerWallet,
} = require("../utils/serverwalletmanager");
const { updateDonationStats } = require("../utils/PlayerStatsManager");
const { EMOJIS, formatAmount } = require("../utils/embedcreator");
const { logger } = require("../enhanced-logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("donate")
    .setDescription("Donate your in-game funds to the server event pool.")
    .addStringOption((option) =>
      option
        .setName("amount")
        .setDescription("The amount to donate.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("currency")
        .setDescription("The currency to donate.")
        .setRequired(true)
        .addChoices(
          { name: "07", value: "osrs" },
          { name: "RS3", value: "rs3" }
        )
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.user;
      const rawAmount = interaction.options.getString("amount");
      const currency = interaction.options.getString("currency");

      logger.info(
        "DonateCommand",
        `Donation requested by ${user.tag} for ${rawAmount} ${currency}`
      );

      // Parse amount safely
      let amount;
      try {
        amount = parseAmount(rawAmount);
        if (!amount || amount <= 0n) {
          return interaction.editReply({
            content: "❌ Invalid amount format.",
          });
        }
      } catch (error) {
        logger.error(
          "DonateCommand",
          `Error parsing amount: ${error.message}`,
          { rawAmount }
        );
        return interaction.editReply({ content: "❌ Invalid amount format." });
      }

      const userWallet = await getWallet(user.id);
      if (userWallet[currency] < amount) {
        return interaction.editReply({
          content: `❌ You do not have enough ${currency.toUpperCase()} to donate.`,
        });
      }

      // Ensure we have a valid guild ID
      if (!interaction.guild || !interaction.guild.id) {
        return interaction.editReply({
          content: "❌ This command can only be used in a server.",
        });
      }

      try {
        // Get server wallet with the guild ID
        const serverWallet = await getServerWallet(interaction.guild.id);

        // Update wallets with safe BigInt operations
        userWallet[currency] = BigInt(userWallet[currency]) - BigInt(amount);
        serverWallet[currency] =
          BigInt(serverWallet[currency]) + BigInt(amount);

        await updateWallet(user.id, userWallet);
        await updateServerWallet(interaction.guild.id, serverWallet);

        // Log the donation for the leaderboard
        await updateDonationStats(user.id, currency, amount);

        logger.info("DonateCommand", `Donation completed by ${user.tag}`, {
          amount: amount.toString(),
          currency,
          guildId: interaction.guild.id,
        });

        await interaction.editReply({
          content: `${
            EMOJIS.win
          } Thank you for your generous donation of **${formatAmount(
            amount
          )} ${currency.toUpperCase()}** to the server event pool!`,
        });
      } catch (error) {
        logger.error(
          "DonateCommand",
          `Error processing donation: ${error.message}`,
          error
        );
        return interaction.editReply({
          content: `❌ An error occurred while processing your donation: ${error.message}`,
        });
      }
    } catch (error) {
      logger.error("DonateCommand", `General error: ${error.message}`, error);
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: "❌ An error occurred while processing your donation.",
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      if (args.length < 2) {
        return message.reply(
          "❌ Invalid command usage. Format: `!donate <amount> <currency>`"
        );
      }

      const user = message.author;
      const rawAmount = args[0];
      const currency = args[1].toLowerCase();

      // Validate currency
      if (currency !== "osrs" && currency !== "rs3") {
        return message.reply("❌ Invalid currency. Must be 'osrs' or 'rs3'.");
      }

      logger.info(
        "DonateCommand",
        `Donation requested by ${user.tag} for ${rawAmount} ${currency}`
      );

      // Parse amount safely - UPDATED TO MATCH YOUR EXISTING IMPLEMENTATION
      let amount;
      try {
        amount = parseAmount(rawAmount);
        if (!amount || amount <= 0n) {
          return message.reply("❌ Invalid amount format.");
        }
      } catch (error) {
        logger.error(
          "DonateCommand",
          `Error parsing amount: ${error.message}`,
          { rawAmount }
        );
        return message.reply("❌ Invalid amount format.");
      }

      const userWallet = await getWallet(user.id);
      if (userWallet[currency] < amount) {
        return message.reply(
          `❌ You do not have enough ${currency.toUpperCase()} to donate.`
        );
      }

      // Ensure we have a valid guild ID
      if (!message.guild || !message.guild.id) {
        return message.reply("❌ This command can only be used in a server.");
      }

      try {
        // Get server wallet with the guild ID
        const serverWallet = await getServerWallet(message.guild.id);

        // Update wallets with safe BigInt operations
        userWallet[currency] = BigInt(userWallet[currency]) - BigInt(amount);
        serverWallet[currency] =
          BigInt(serverWallet[currency]) + BigInt(amount);

        await updateWallet(user.id, userWallet);
        await updateServerWallet(message.guild.id, serverWallet);

        // Log the donation for the leaderboard
        await updateDonationStats(user.id, currency, amount);

        logger.info("DonateCommand", `Donation completed by ${user.tag}`, {
          amount: amount.toString(),
          currency,
          guildId: message.guild.id,
        });

        await message.reply(
          `${
            EMOJIS.win
          } Thank you for your generous donation of **${formatAmount(
            amount
          )} ${currency.toUpperCase()}** to the server event pool!`
        );
      } catch (error) {
        logger.error(
          "DonateCommand",
          `Error processing donation: ${error.message}`,
          error
        );
        return message.reply(
          `❌ An error occurred while processing your donation: ${error.message}`
        );
      }
    } catch (error) {
      logger.error(
        "DonateCommand",
        `General error in prefix command: ${error.message}`,
        error
      );
      await message.reply(
        "❌ An error occurred while processing your donation."
      );
    }
  },

  // Command aliases
  aliases: ["don"],
};
