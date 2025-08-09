// commands/dice.js
const { SlashCommandBuilder } = require("discord.js");
const { placeBet } = require("../utils/DiceManager");
const { getDefaultCurrency } = require("../utils/UserPreferencesManager");
const { formatAmount } = require("../utils/embedcreator");
const { parseAmount } = require("../utils/amountParser");
const { logger } = require("../utils/enhanced-logger");
const {
  withErrorHandling,
  ValidationError,
} = require("../utils/error-handler");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dice")
    .setDescription("Place a bet on a host's dice table")
    .addUserOption((option) =>
      option
        .setName("host")
        .setDescription("The host running the dice table")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("amount")
        .setDescription("Amount to bet (e.g. 100, 1k, 5m, 2b)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("bet_type")
        .setDescription("Type of bet (h/l/o/u or a number 1-100)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("currency")
        .setDescription("Currency to bet with")
        .setRequired(false)
        .addChoices(
          { name: "OSRS", value: "osrs" },
          { name: "RS3", value: "rs3" }
        )
    ),

  execute: withErrorHandling(async function (interaction) {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const host = interaction.options.getUser("host");
    const hostId = host.id;
    const amountInput = interaction.options.getString("amount");
    const betTypeInput = interaction.options.getString("bet_type");
    let currency = interaction.options.getString("currency");

    // If currency is not provided, use default
    if (!currency) {
      currency = await getDefaultCurrency(userId);
    }

    // Parse amount
    let amount;
    if (amountInput.toLowerCase() === "all") {
      // Handle 'all' by getting wallet balance
      const { getWallet } = require("../utils/WalletManager");
      const wallet = await getWallet(userId);
      amount = wallet[currency];

      // Check if wallet has any balance
      if (BigInt(amount) <= 0) {
        throw new ValidationError(
          `You don't have any ${currency.toUpperCase()} to bet.`
        );
      }
    } else {
      // Parse numeric amount using the amountParser utility
      const parsedAmount = parseAmount(amountInput);

      if (parsedAmount.error) {
        throw new ValidationError(parsedAmount.error);
      }

      amount = parsedAmount.value.toString();

      // Check if amount is positive
      if (BigInt(amount) <= 0) {
        throw new ValidationError("Bet amount must be positive.");
      }
    }

    // Parse bet type
    let betOn;
    let specificNumber = null;

    const betType = betTypeInput.toLowerCase();

    if (betType === "h") {
      betOn = "higher";
    } else if (betType === "l") {
      betOn = "lower";
    } else if (betType === "o") {
      betOn = "over";
    } else if (betType === "u") {
      betOn = "under";
    } else {
      // Check if it's a number
      const num = parseInt(betType);
      if (!isNaN(num) && num >= 1 && num <= 100) {
        betOn = "number";
        specificNumber = num;
      } else {
        throw new ValidationError(
          "Invalid bet type. Use h (higher), l (lower), o (over), u (under), or a number 1-100."
        );
      }
    }

    // Place bet
    const result = await placeBet(
      userId,
      hostId,
      amount,
      currency,
      betOn,
      specificNumber
    );

    if (!result.success) {
      throw new ValidationError(result.message);
    }

    // Create response
    const response = `✅ Bet placed successfully! You bet ${formatAmount(
      amount
    )} ${currency.toUpperCase()} on ${betOn}${
      specificNumber ? ` (${specificNumber})` : ""
    } at ${host.username}'s dice table.`;

    await interaction.editReply({ content: response });

    // Log the bet
    logger.info("DiceBet", `User ${userId} placed bet on ${hostId}'s table`, {
      amount,
      currency,
      betType: betOn,
      specificNumber,
    });
  }, "DiceCommand"),

  // For prefix command usage
  async run(message, args) {
    try {
      if (args.length < 3) {
        return message.reply(
          "❌ Please provide all required arguments. Usage: `!dice @host amount bet_type [currency]`"
        );
      }

      const userId = message.author.id;

      // Parse host
      const hostMention = args[0];
      const hostId = hostMention.replace(/[<@!>]/g, "");
      const host = await message.client.users.fetch(hostId).catch(() => null);

      if (!host) {
        return message.reply("❌ Invalid host. Please mention a valid user.");
      }

      // Parse amount
      const amountInput = args[1];

      // Parse bet type
      const betTypeInput = args[2].toLowerCase();

      // Parse currency (optional)
      let currency = args[3]?.toLowerCase();

      // Validate currency
      if (currency && currency !== "osrs" && currency !== "rs3") {
        return message.reply('❌ Invalid currency. Must be "osrs" or "rs3".');
      }

      // If currency is not provided, use default
      if (!currency) {
        currency = await getDefaultCurrency(userId);
      }

      // Parse amount
      let amount;
      if (amountInput.toLowerCase() === "all") {
        // Handle 'all' by getting wallet balance
        const { getWallet } = require("../utils/WalletManager");
        const wallet = await getWallet(userId);
        amount = wallet[currency];

        // Check if wallet has any balance
        if (BigInt(amount) <= 0) {
          return message.reply(
            `❌ You don't have any ${currency.toUpperCase()} to bet.`
          );
        }
      } else {
        // Parse numeric amount using the amountParser utility
        const parsedAmount = parseAmount(amountInput);

        if (parsedAmount.error) {
          return message.reply(`❌ ${parsedAmount.error}`);
        }

        amount = parsedAmount.value.toString();

        // Check if amount is positive
        if (BigInt(amount) <= 0) {
          return message.reply("❌ Bet amount must be positive.");
        }
      }

      // Parse bet type
      let betOn;
      let specificNumber = null;

      if (betTypeInput === "h") {
        betOn = "higher";
      } else if (betTypeInput === "l") {
        betOn = "lower";
      } else if (betTypeInput === "o") {
        betOn = "over";
      } else if (betTypeInput === "u") {
        betOn = "under";
      } else {
        // Check if it's a number
        const num = parseInt(betTypeInput);
        if (!isNaN(num) && num >= 1 && num <= 100) {
          betOn = "number";
          specificNumber = num;
        } else {
          return message.reply(
            "❌ Invalid bet type. Use h (higher), l (lower), o (over), u (under), or a number 1-100."
          );
        }
      }

      // Place bet
      const result = await placeBet(
        userId,
        hostId,
        amount,
        currency,
        betOn,
        specificNumber
      );

      if (!result.success) {
        return message.reply(`❌ ${result.message}`);
      }

      // Create response
      const response = `✅ Bet placed successfully! You bet ${formatAmount(
        amount
      )} ${currency.toUpperCase()} on ${betOn}${
        specificNumber ? ` (${specificNumber})` : ""
      } at ${host.username}'s dice table.`;

      await message.reply(response);

      // Log the bet
      logger.info("DiceBet", `User ${userId} placed bet on ${hostId}'s table`, {
        amount,
        currency,
        betType: betOn,
        specificNumber,
      });
    } catch (error) {
      logger.error("DiceCommand", "Error in dice command", error);
      await message.reply("❌ An error occurred while placing your bet.");
    }
  },

  // Command aliases
  aliases: ["d"],

  // Command cooldown in seconds
  cooldown: 1,
};
