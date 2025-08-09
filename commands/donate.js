// commands/donate.js
const { SlashCommandBuilder } = require("discord.js");
const parseAmount = require("../utils/parseAmount");
const { getWallet, updateWallet } = require("../utils/WalletManager");
const {
  getServerWallet,
  updateServerWallet,
} = require("../utils/ServerWalletManager");
const { updateDonationStats } = require("../utils/PlayerStatsManager");
const { EMOJIS, formatAmount } = require("../utils/embedcreator");

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
      console.log(
        `[EXECUTE] /donate by ${user.tag} for ${rawAmount} ${currency}`
      );

      const amount = parseAmount(rawAmount);
      if (amount <= 0n) {
        return interaction.editReply({ content: "❌ Invalid amount format." });
      }

      const userWallet = await getWallet(user.id);
      if (userWallet[currency] < amount) {
        return interaction.editReply({
          content: `❌ You do not have enough ${currency.toUpperCase()} to donate.`,
        });
      }

      const serverWallet = await getServerWallet(interaction.guild.id);

      userWallet[currency] -= amount;
      serverWallet[currency] += amount;

      await updateWallet(user.id, userWallet);
      await updateServerWallet(interaction.guild.id, serverWallet);

      // Log the donation for the leaderboard
      await updateDonationStats(user.id, currency, amount);

      await interaction.editReply({
        content: `${
          EMOJIS.win
        } Thank you for your generous donation of **${formatAmount(
          amount
        )} ${currency.toUpperCase()}** to the server event pool!`,
      });
    } catch (error) {
      console.error("Error in /donate command:", error);
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

      console.log(`[RUN] !donate by ${user.tag} for ${rawAmount} ${currency}`);

      const amount = parseAmount(rawAmount);
      if (amount <= 0n) {
        return message.reply("❌ Invalid amount format.");
      }

      const userWallet = await getWallet(user.id);
      if (userWallet[currency] < amount) {
        return message.reply(
          `❌ You do not have enough ${currency.toUpperCase()} to donate.`
        );
      }

      const serverWallet = await getServerWallet(message.guild.id);

      userWallet[currency] -= amount;
      serverWallet[currency] += amount;

      await updateWallet(user.id, userWallet);
      await updateServerWallet(message.guild.id, serverWallet);

      // Log the donation for the leaderboard
      await updateDonationStats(user.id, currency, amount);

      await message.reply(
        `${EMOJIS.win} Thank you for your generous donation of **${formatAmount(
          amount
        )} ${currency.toUpperCase()}** to the server event pool!`
      );
    } catch (error) {
      console.error("Error in !donate command:", error);
      await message.reply(
        "❌ An error occurred while processing your donation."
      );
    }
  },
};

// This command allows users to donate their in-game funds to the server event pool.
// It checks the user's wallet, validates the donation amount, and updates both the user's and server's wallets.
