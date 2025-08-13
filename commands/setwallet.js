// commands/setwallet.js
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const parseAmount = require("../utils/parseAmount");
const { getWallet, updateWallet } = require("../utils/WalletManager");
const { EMOJIS, formatAmount } = require("../utils/embedcreator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setwallet")
    .setDescription("Set a user's wallet balance (Admin only).")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // This restricts to admin only
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to modify.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("currency")
        .setDescription("The currency to modify.")
        .setRequired(true)
        .addChoices(
          { name: "07", value: "osrs" },
          { name: "RS3", value: "rs3" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("amount")
        .setDescription("The new amount.")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      // Double-check permissions
      if (
        !interaction.memberPermissions.has(PermissionFlagsBits.Administrator)
      ) {
        return interaction.reply({
          content: "❌ You need administrator permissions to use this command.",
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });
      const targetUser = interaction.options.getUser("user");
      const currency = interaction.options.getString("currency");
      const rawAmount = interaction.options.getString("amount");

      const amount = parseAmount(rawAmount);
      if (amount < 0n) {
        return interaction.editReply({
          content: "❌ Amount cannot be negative.",
        });
      }

      const wallet = await getWallet(targetUser.id);
      const oldAmount = wallet[currency];
      wallet[currency] = amount;

      await updateWallet(targetUser.id, wallet);

      await interaction.editReply({
        content: `${EMOJIS.win} Successfully set ${
          targetUser.username
        }'s ${currency.toUpperCase()} balance from **${formatAmount(
          oldAmount
        )}** to **${formatAmount(amount)}**.`,
      });
    } catch (error) {
      console.error("Error in /setwallet command:", error);
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: "❌ An error occurred while updating the wallet.",
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      // Check permissions
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return message.reply(
          "❌ You need administrator permissions to use this command."
        );
      }

      if (args.length < 3) {
        return message.reply(
          "❌ Invalid command usage. Format: `!setwallet <user> <currency> <amount>`"
        );
      }

      // Parse arguments
      const userMention = args[0];
      const userId = userMention.replace(/[<@!>]/g, "");
      const targetUser = await message.client.users
        .fetch(userId)
        .catch(() => null);

      if (!targetUser) {
        return message.reply("❌ Invalid user. Please mention a valid user.");
      }

      const currencyInput = args[1].toLowerCase();
      let currency;

      if (currencyInput === "osrs" || currencyInput === "osrs") {
        currency = "osrs";
      } else if (currencyInput === "rs3") {
        currency = "rs3";
      } else {
        return message.reply(
          "❌ Invalid currency. Please use 'osrs', 'osrs', or 'rs3'."
        );
      }

      const rawAmount = args[2];

      const amount = parseAmount(rawAmount);
      if (amount < 0n) {
        return message.reply("❌ Amount cannot be negative.");
      }

      const wallet = await getWallet(targetUser.id);
      const oldAmount = wallet[currency];
      wallet[currency] = amount;

      await updateWallet(targetUser.id, wallet);

      await message.reply(
        `${EMOJIS.win} Successfully set ${
          targetUser.username
        }'s ${currency.toUpperCase()} balance from **${formatAmount(
          oldAmount
        )}** to **${formatAmount(amount)}**.`
      );
    } catch (error) {
      console.error("Error in !setwallet command:", error);
      await message.reply("❌ An error occurred while updating the wallet.");
    }
  },
};

// This command allows administrators to set a user's wallet balance for a specific currency.
// It validates the amount, fetches the user's wallet, updates it, and logs the action
