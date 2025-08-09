// commands/send.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getWallet, updateWallet } = require("../utils/WalletManager");
const { formatAmount, EMOJIS } = require("../utils/embedcreator");
const { parseAmount } = require("../utils/amountParser");
const { getDefaultCurrency } = require("../utils/UserPreferencesManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("send")
    .setDescription("Send currency to another user.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to send to.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("amount")
        .setDescription("The amount to send.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("currency")
        .setDescription("The currency to send.")
        .setRequired(false)
        .addChoices(
          { name: "07", value: "osrs" },
          { name: "RS3", value: "rs3" }
        )
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const sender = interaction.user;
      const recipient = interaction.options.getUser("user");
      const rawAmount = interaction.options.getString("amount");
      let currency = interaction.options.getString("currency");

      // If currency not specified, use default
      if (!currency) {
        try {
          currency = await getDefaultCurrency(interaction.user.id);
        } catch (error) {
          console.error("Error getting default currency:", error);
          currency = "osrs"; // Fallback to osrs
        }
      }

      // Prevent sending to self
      if (sender.id === recipient.id) {
        return interaction.editReply({
          content: "❌ You cannot send currency to yourself.",
        });
      }

      // Prevent sending to bots
      if (recipient.bot) {
        return interaction.editReply({
          content: "❌ You cannot send currency to a bot.",
        });
      }

      // Parse the amount
      const parsedAmount = parseAmount(rawAmount);
      if (parsedAmount.error) {
        return interaction.editReply({ content: `❌ ${parsedAmount.error}` });
      }

      const amount = parsedAmount.value;

      // Check if amount is positive
      if (amount <= 0) {
        return interaction.editReply({
          content: "❌ Amount must be greater than 0.",
        });
      }

      // Get sender's wallet
      const senderWallet = await getWallet(sender.id);

      // Check if wallet is locked
      if (senderWallet.isLocked) {
        return interaction.editReply({
          content:
            "❌ Your wallet is locked. You cannot send currency at this time.",
        });
      }

      // Check if sender has enough funds
      if (senderWallet[currency] < amount) {
        return interaction.editReply({
          content: `❌ You don't have enough ${currency.toUpperCase()} to send. Your balance: ${formatAmount(
            senderWallet[currency]
          )}`,
        });
      }

      // Get recipient's wallet
      const recipientWallet = await getWallet(recipient.id);

      // Update wallets
      senderWallet[currency] -= amount;
      recipientWallet[currency] += amount;

      // Save updated wallets
      await updateWallet(sender.id, senderWallet);
      await updateWallet(recipient.id, recipientWallet);

      // Create success embed
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(`${EMOJIS.win} Currency Sent Successfully`)
        .setDescription(
          `You sent ${formatAmount(
            amount
          )} ${currency.toUpperCase()} to ${recipient.toString()}.`
        )
        .addFields({
          name: "Your New Balance",
          value: `${formatAmount(
            senderWallet[currency]
          )} ${currency.toUpperCase()}`,
          inline: true,
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Notify recipient
      try {
        const notificationEmbed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle(`${EMOJIS.win} Currency Received`)
          .setDescription(
            `You received ${formatAmount(
              amount
            )} ${currency.toUpperCase()} from ${sender.toString()}.`
          )
          .addFields({
            name: "Your New Balance",
            value: `${formatAmount(
              recipientWallet[currency]
            )} ${currency.toUpperCase()}`,
            inline: true,
          })
          .setTimestamp();

        await recipient.send({ embeds: [notificationEmbed] }).catch(() => {
          // Silently fail if user has DMs disabled
        });
      } catch (error) {
        console.error("Failed to send DM to recipient:", error);
      }
    } catch (error) {
      console.error("Error in /send command:", error);
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: "❌ An error occurred while sending currency.",
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      if (args.length < 2) {
        return message.reply(
          "❌ Invalid command usage. Format: `!send <user> <amount> [currency]`"
        );
      }

      const sender = message.author;

      // Parse user mention
      const recipientMention = args[0];
      const recipientId = recipientMention.replace(/[<@!>]/g, "");
      const recipient = await message.client.users
        .fetch(recipientId)
        .catch(() => null);

      if (!recipient) {
        return message.reply("❌ Invalid user. Please mention a valid user.");
      }

      const rawAmount = args[1];
      let currency = args[2]?.toLowerCase();

      // Validate currency
      if (currency && currency !== "osrs" && currency !== "rs3") {
        return message.reply("❌ Invalid currency. Must be 'osrs' or 'rs3'.");
      }

      // If currency not specified, use default
      if (!currency) {
        try {
          currency = await getDefaultCurrency(message.author.id);
        } catch (error) {
          console.error("Error getting default currency:", error);
          currency = "osrs"; // Fallback to osrs
        }
      }

      // Prevent sending to self
      if (sender.id === recipient.id) {
        return message.reply("❌ You cannot send currency to yourself.");
      }

      // Prevent sending to bots
      if (recipient.bot) {
        return message.reply("❌ You cannot send currency to a bot.");
      }

      // Parse the amount
      const parsedAmount = parseAmount(rawAmount);
      if (parsedAmount.error) {
        return message.reply(`❌ ${parsedAmount.error}`);
      }

      const amount = parsedAmount.value;

      // Check if amount is positive
      if (amount <= 0) {
        return message.reply("❌ Amount must be greater than 0.");
      }

      // Get sender's wallet
      const senderWallet = await getWallet(sender.id);

      // Check if wallet is locked
      if (senderWallet.isLocked) {
        return message.reply(
          "❌ Your wallet is locked. You cannot send currency at this time."
        );
      }

      // Check if sender has enough funds
      if (senderWallet[currency] < amount) {
        return message.reply(
          `❌ You don't have enough ${currency.toUpperCase()} to send. Your balance: ${formatAmount(
            senderWallet[currency]
          )}`
        );
      }

      // Get recipient's wallet
      const recipientWallet = await getWallet(recipient.id);

      // Update wallets
      senderWallet[currency] -= amount;
      recipientWallet[currency] += amount;

      // Save updated wallets
      await updateWallet(sender.id, senderWallet);
      await updateWallet(recipient.id, recipientWallet);

      // Create success embed
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(`${EMOJIS.win} Currency Sent Successfully`)
        .setDescription(
          `You sent ${formatAmount(
            amount
          )} ${currency.toUpperCase()} to ${recipient.toString()}.`
        )
        .addFields({
          name: "Your New Balance",
          value: `${formatAmount(
            senderWallet[currency]
          )} ${currency.toUpperCase()}`,
          inline: true,
        })
        .setTimestamp();

      await message.reply({ embeds: [embed] });

      // Notify recipient
      try {
        const notificationEmbed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle(`${EMOJIS.win} Currency Received`)
          .setDescription(
            `You received ${formatAmount(
              amount
            )} ${currency.toUpperCase()} from ${sender.toString()}.`
          )
          .addFields({
            name: "Your New Balance",
            value: `${formatAmount(
              recipientWallet[currency]
            )} ${currency.toUpperCase()}`,
            inline: true,
          })
          .setTimestamp();

        await recipient.send({ embeds: [notificationEmbed] }).catch(() => {
          // Silently fail if user has DMs disabled
        });
      } catch (error) {
        console.error("Failed to send DM to recipient:", error);
      }
    } catch (error) {
      console.error("Error in !send command:", error);
      await message.reply("❌ An error occurred while sending currency.");
    }
  },
};

// This command allows users to send RS3 or 07 coins to another user.
// It validates the recipient, checks the sender's balance, and updates both wallets accordingly.
