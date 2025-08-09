// commands/dice-duel.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  createDiceDuel,
  getActiveDuelByPlayer,
  cancelDiceDuel,
} = require("../utils/DiceDuelManager");
const { getWallet, updateWallet } = require("../utils/WalletManager");
const { formatAmount, EMOJIS } = require("../utils/embedcreator");
const { getDefaultCurrency } = require("../utils/UserPreferencesManager");
const { logger } = require("../utils/enhanced-logger");
const {
  withErrorHandling,
  ValidationError,
} = require("../utils/error-handler");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("diceduel")
    .setDescription("Challenge another player to a dice duel.")
    .addUserOption((option) =>
      option
        .setName("opponent")
        .setDescription("The opponent to challenge.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("amount")
        .setDescription("The amount to bet.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("currency")
        .setDescription("The currency to bet.")
        .setRequired(false)
        .addChoices(
          { name: "07", value: "osrs" },
          { name: "RS3", value: "rs3" }
        )
    ),

  execute: withErrorHandling(async function (interaction) {
    await interaction.deferReply();

    const challenger = interaction.user;
    const opponent = interaction.options.getUser("opponent");
    const rawAmount = interaction.options.getString("amount");
    let currency = interaction.options.getString("currency");

    // If currency not specified, use default
    if (!currency) {
      try {
        currency = await getDefaultCurrency(interaction.user.id);
      } catch (error) {
        logger.error("DiceDuel", "Error getting default currency", error);
        currency = "osrs"; // Fallback to osrs
      }
    }

    // Prevent dueling self
    if (challenger.id === opponent.id) {
      throw new ValidationError("You cannot duel yourself.");
    }

    // Prevent dueling bots
    if (opponent.bot) {
      throw new ValidationError("You cannot duel a bot.");
    }

    // Parse the amount
    let amount;
    try {
      // If you're using the parseAmount function from utils/amountParser.js
      const { parseAmount } = require("../utils/amountParser");
      const result = parseAmount(rawAmount);
      if (result.error) {
        throw new ValidationError(result.error);
      }
      amount = result.value;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Invalid amount: ${error.message}`);
    }

    // Check if amount is positive - using BigInt comparison
    if (amount <= 0n) {
      throw new ValidationError("Bet amount must be greater than 0.");
    }

    // Get challenger's wallet
    const challengerWallet = await getWallet(challenger.id);

    // Check if wallet is locked
    if (challengerWallet.isLocked) {
      throw new ValidationError(
        "Your wallet is locked. You cannot start dice duels at this time."
      );
    }

    // Check if challenger has enough funds
    const walletBalance = BigInt(challengerWallet[currency] || 0);
    if (walletBalance < amount) {
      throw new ValidationError(
        `You don't have enough ${currency.toUpperCase()} to bet. Your balance: ${formatAmount(
          walletBalance
        )}`
      );
    }

    // Check if challenger already has an active duel
    const existingDuel = getActiveDuelByPlayer(challenger.id);
    if (existingDuel) {
      throw new ValidationError(
        "You already have an active dice duel. Cancel it first with `/diceduel-cancel`."
      );
    }

    // Check if opponent already has an active duel
    const opponentDuel = getActiveDuelByPlayer(opponent.id);
    if (opponentDuel) {
      throw new ValidationError(
        "Your opponent already has an active dice duel."
      );
    }

    // REMOVED: Deduction from challenger's wallet - this is now handled in createDiceDuel

    // Create the duel
    const result = await createDiceDuel(
      challenger.id,
      opponent.id,
      amount.toString(),
      currency
    );

    if (!result.success) {
      throw new ValidationError(result.message);
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(0x9c27b0)
      .setTitle(`${EMOJIS.dice} Dice Duel Challenge`)
      .setDescription(
        `${challenger.toString()} has challenged ${opponent.toString()} to a dice duel!`
      )
      .addFields(
        {
          name: "Bet Amount",
          value: `${formatAmount(amount)} ${currency.toUpperCase()}`,
          inline: true,
        },
        {
          name: "How to Play",
          value:
            "1. Opponent must click Accept\n2. Both players use `/diceduel-roll` to roll\n3. Highest roll wins!",
          inline: false,
        }
      )
      .setFooter({ text: `Duel ID: ${result.duel.id}` })
      .setTimestamp();

    // Create buttons
    const acceptButton = {
      type: 2,
      style: 3,
      label: "Accept",
      custom_id: `dice_duel_accept_${result.duel.id}`,
    };

    const declineButton = {
      type: 2,
      style: 4,
      label: "Decline",
      custom_id: `dice_duel_decline_${result.duel.id}`,
    };

    const actionRow = {
      type: 1,
      components: [acceptButton, declineButton],
    };

    await interaction.editReply({ embeds: [embed], components: [actionRow] });

    // Log the duel creation
    logger.info(
      "DiceDuel",
      `User ${challenger.id} challenged ${opponent.id} to a dice duel`,
      {
        amount: amount.toString(),
        currency,
        duelId: result.duel.id,
      }
    );
  }, "DiceDuelCommand"),

  // For prefix command usage
  async run(message, args) {
    try {
      if (args.length < 2) {
        return message.reply(
          "❌ Invalid command usage. Format: `!diceduel <opponent> <amount> [currency]`"
        );
      }

      const challenger = message.author;
      const opponentMention = args[0];
      const opponentId = opponentMention.replace(/[<@!>]/g, "");
      const opponent = await message.client.users
        .fetch(opponentId)
        .catch(() => null);

      if (!opponent) {
        return message.reply(
          "❌ Invalid opponent. Please mention a valid user."
        );
      }

      const rawAmount = args[1];
      let currency = args[2]?.toLowerCase();

      // If currency not specified, use default
      if (!currency) {
        try {
          currency = await getDefaultCurrency(message.author.id);
        } catch (error) {
          logger.error("DiceDuel", "Error getting default currency", error);
          currency = "osrs"; // Fallback to osrs
        }
      }

      // Validate currency
      if (currency && currency !== "osrs" && currency !== "rs3") {
        return message.reply("❌ Invalid currency. Must be 'osrs' or 'rs3'.");
      }

      // Prevent dueling self
      if (challenger.id === opponent.id) {
        return message.reply("❌ You cannot duel yourself.");
      }

      // Prevent dueling bots
      if (opponent.bot) {
        return message.reply("❌ You cannot duel a bot.");
      }

      // Parse the amount
      let amount;
      try {
        // If you're using the parseAmount function from utils/amountParser.js
        const { parseAmount } = require("../utils/amountParser");
        const result = parseAmount(rawAmount);
        if (result.error) {
          return message.reply(`❌ ${result.error}`);
        }
        amount = result.value;
      } catch (error) {
        return message.reply(`❌ Invalid amount: ${error.message}`);
      }

      // Check if amount is positive
      if (amount <= 0n) {
        return message.reply("❌ Bet amount must be greater than 0.");
      }

      // Get challenger's wallet
      const challengerWallet = await getWallet(challenger.id);

      // Check if wallet is locked
      if (challengerWallet.isLocked) {
        return message.reply(
          "❌ Your wallet is locked. You cannot start dice duels at this time."
        );
      }

      // Check if challenger has enough funds
      const walletBalance = BigInt(challengerWallet[currency] || 0);
      if (walletBalance < amount) {
        return message.reply(
          `❌ You don't have enough ${currency.toUpperCase()} to bet. Your balance: ${formatAmount(
            walletBalance
          )}`
        );
      }

      // Check if challenger already has an active duel
      const existingDuel = getActiveDuelByPlayer(challenger.id);
      if (existingDuel) {
        return message.reply(
          "❌ You already have an active dice duel. Cancel it first with `!diceduel-cancel`."
        );
      }

      // Check if opponent already has an active duel
      const opponentDuel = getActiveDuelByPlayer(opponent.id);
      if (opponentDuel) {
        return message.reply(
          "❌ Your opponent already has an active dice duel."
        );
      }

      // REMOVED: Deduction from challenger's wallet - this is now handled in createDiceDuel

      // Create the duel
      const result = await createDiceDuel(
        challenger.id,
        opponent.id,
        amount.toString(),
        currency
      );

      if (!result.success) {
        return message.reply(`❌ ${result.message}`);
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(0x9c27b0)
        .setTitle(`${EMOJIS.dice} Dice Duel Challenge`)
        .setDescription(
          `${challenger.toString()} has challenged ${opponent.toString()} to a dice duel!`
        )
        .addFields(
          {
            name: "Bet Amount",
            value: `${formatAmount(amount)} ${currency.toUpperCase()}`,
            inline: true,
          },
          {
            name: "How to Play",
            value:
              "1. Opponent must click Accept\n2. Both players use `/diceduel-roll` to roll\n3. Highest roll wins!",
            inline: false,
          }
        )
        .setFooter({ text: `Duel ID: ${result.duel.id}` })
        .setTimestamp();

      // Create buttons
      const acceptButton = {
        type: 2,
        style: 3,
        label: "Accept",
        custom_id: `dice_duel_accept_${result.duel.id}`,
      };

      const declineButton = {
        type: 2,
        style: 4,
        label: "Decline",
        custom_id: `dice_duel_decline_${result.duel.id}`,
      };

      const actionRow = {
        type: 1,
        components: [acceptButton, declineButton],
      };

      await message.reply({ embeds: [embed], components: [actionRow] });

      // Log the duel creation
      logger.info(
        "DiceDuel",
        `User ${challenger.id} challenged ${opponent.id} to a dice duel`,
        {
          amount: amount.toString(),
          currency,
          duelId: result.duel.id,
        }
      );
    } catch (error) {
      logger.error("DiceDuel", "Error in !diceduel command", error);
      await message.reply(`❌ An error occurred: ${error.message}`);
    }
  },

  // Command aliases
  aliases: ["dd"],
};
