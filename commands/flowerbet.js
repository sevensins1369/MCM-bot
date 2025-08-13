// commands/flowerbet.js
// Command to place a bet on a flower game

const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { getWallet, updateWallet } = require("../utils/WalletManager");
const {
  getFlowerGame,
  validateBetType,
  addBet,
} = require("../utils/FlowerGameManager");
const { EMOJIS, formatAmount } = require("../utils/embedcreator");
const { parseAmount } = require("../utils/amountParser");
const { getDefaultCurrency } = require("../utils/UserPreferencesManager");
const {
  ValidationError,
  withErrorHandling,
} = require("../utils/error-handler");

module.exports = {
  // Slash command definition
  data: new SlashCommandBuilder()
    .setName("flowerbet")
    .setDescription("Place a bet on a flower game")
    .addUserOption((option) =>
      option
        .setName("host")
        .setDescription("The host of the flower game")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("amount")
        .setDescription("The amount to bet")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("bet_type")
        .setDescription("The type of bet")
        .setRequired(true)
        .addChoices(
          // Hot/Cold game
          { name: "Hot", value: "hot" },
          { name: "Cold", value: "cold" },
          { name: "Tie", value: "tie" },
          // Flower colors
          { name: "Red", value: "red" },
          { name: "Orange", value: "orange" },
          { name: "Yellow", value: "yellow" },
          { name: "Blue", value: "blue" },
          { name: "Purple", value: "purple" },
          { name: "White", value: "white" },
          { name: "Black", value: "black" },
          { name: "Rainbow", value: "rainbow" },
          { name: "Pastel", value: "pastel" },
          // Flower Poker
          { name: "Host (Flower Poker)", value: "host" },
          { name: "Player (Flower Poker)", value: "player" },
          // Rainbow Mania
          { name: "Wildcard", value: "wildcard" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("currency")
        .setDescription("The currency to bet with")
        .setRequired(false)
        .addChoices(
          { name: "07", value: "osrs" },
          { name: "RS3", value: "rs3" }
        )
    ),

  // Slash command execution
  execute: withErrorHandling(async function (interaction) {
    await interaction.deferReply();

    // Get options
    const hostId = interaction.options.getUser("host").id;
    const amountStr = interaction.options.getString("amount");
    const currencyOption = interaction.options.getString("currency");
    const betType = interaction.options.getString("bet_type");

    // Get user's default currency if not specified
    const currency =
      currencyOption || (await getDefaultCurrency(interaction.user.id));

    // Parse amount
    const parsedAmount = parseAmount(amountStr);
    if (parsedAmount.error) {
      throw new ValidationError(parsedAmount.error);
    }

    const amount = parsedAmount.value;

    // Get user's wallet
    const wallet = await getWallet(interaction.user.id);

    // Check if user has enough funds - FIX: Convert wallet value to BigInt
    const walletBalance = BigInt(wallet[currency] || 0);
    if (walletBalance < amount) {
      throw new ValidationError(
        `You don't have enough ${currency.toUpperCase()} for this bet.`
      );
    }

    // Find the host
    const host = await interaction.guild.members
      .fetch(hostId)
      .catch(() => null);
    if (!host) {
      throw new ValidationError("Host not found.");
    }

    // Get the flower game
    const game = getFlowerGame(hostId);
    if (!game) {
      throw new ValidationError(
        `${host.user.username} does not have an active flower game.`
      );
    }

    // Check if betting is open
    if (!game.isOpen) {
      throw new ValidationError("Betting is closed for this flower game.");
    }

    // Validate bet type for the specific game mode
    try {
      validateBetType(game.gameType, betType);
    } catch (error) {
      throw new ValidationError(error.message);
    }

    // Deduct amount from wallet - FIX: Use BigInt operations
    wallet[currency] = (walletBalance - amount).toString();
    await updateWallet(interaction.user.id, wallet);

    // Place bet
    await addBet(hostId, {
      playerId: interaction.user.id,
      amount: amount.toString(),
      currency,
      betType,
      minigameChoices: [],
      minigameResults: {},
    });

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS.cards} Flower Bet Placed`)
      .setColor(0x4caf50)
      .setDescription(
        `You placed a bet on ${host.user.username}'s flower game.`
      )
      .addFields(
        {
          name: "Amount",
          value: formatAmount(amount) + " " + currency.toUpperCase(),
          inline: true,
        },
        {
          name: "Bet Type",
          value: betType.charAt(0).toUpperCase() + betType.slice(1),
          inline: true,
        },
        {
          name: "Game Type",
          value: formatGameType(game.gameType),
          inline: true,
        }
      )
      .setTimestamp()
      .setFooter({ text: "Flower Bet" });

    // Send embed
    await interaction.editReply({
      embeds: [embed],
      ephemeral: true,
    });
  }, "FlowerBetCommand"),

  // Prefix command execution
  async run(message, args) {
    try {
      // Check arguments
      if (args.length < 3) {
        throw new ValidationError(
          "Usage: !flowerbet <host> <amount> <bet_type> [currency]"
        );
      }

      // Get arguments
      const hostId = args[0].replace(/[<@!>]/g, "");
      const amountStr = args[1];
      const betType = args[2].toLowerCase();
      const currencyOption = args[3] ? args[3].toLowerCase() : null;

      // Get user's default currency if not specified
      const currency =
        currencyOption || (await getDefaultCurrency(message.author.id));

      // Parse amount
      const parsedAmount = parseAmount(amountStr);
      if (parsedAmount.error) {
        throw new ValidationError(parsedAmount.error);
      }

      const amount = parsedAmount.value;

      // Get user's wallet
      const wallet = await getWallet(message.author.id);

      // Check if user has enough funds - FIX: Convert wallet value to BigInt
      const walletBalance = BigInt(wallet[currency] || 0);
      if (walletBalance < amount) {
        throw new ValidationError(
          `You don't have enough ${currency.toUpperCase()} for this bet.`
        );
      }

      // Find the host
      const host = await message.guild.members.fetch(hostId).catch(() => null);
      if (!host) {
        throw new ValidationError("Host not found.");
      }

      // Get the flower game
      const game = getFlowerGame(hostId);
      if (!game) {
        throw new ValidationError(
          `${host.user.username} does not have an active flower game.`
        );
      }

      // Check if betting is open
      if (!game.isOpen) {
        throw new ValidationError("Betting is closed for this flower game.");
      }

      // Validate bet type for the specific game mode
      try {
        validateBetType(game.gameType, betType);
      } catch (error) {
        throw new ValidationError(error.message);
      }

      // Deduct amount from wallet - FIX: Use BigInt operations
      wallet[currency] = (walletBalance - amount).toString();
      await updateWallet(message.author.id, wallet);

      // Place bet
      await addBet(hostId, {
        playerId: message.author.id,
        amount: amount.toString(),
        currency,
        betType,
        minigameChoices: [],
        minigameResults: {},
      });

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`${EMOJIS.cards} Flower Bet Placed`)
        .setColor(0x4caf50)
        .setDescription(
          `You placed a bet on ${host.user.username}'s flower game.`
        )
        .addFields(
          {
            name: "Amount",
            value: formatAmount(amount) + " " + currency.toUpperCase(),
            inline: true,
          },
          {
            name: "Bet Type",
            value: betType.charAt(0).toUpperCase() + betType.slice(1),
            inline: true,
          },
          {
            name: "Game Type",
            value: formatGameType(game.gameType),
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({ text: "Flower Bet" });

      // Send embed
      await message.reply({ embeds: [embed] });
    } catch (error) {
      // Handle errors for prefix command
      if (error instanceof ValidationError) {
        await message.reply(`⚠️ ${error.message}`);
      } else {
        console.error("Error in !flowerbet command:", error);
        await message.reply("❌ An error occurred while placing your bet.");
      }
    }
  },

  // Command aliases
  aliases: ["fb"],
};

// Helper function to format game type for display
function formatGameType(gameType) {
  switch (gameType) {
    case "hot_cold":
      return "Hot/Cold";
    case "flower_poker":
      return "Flower Poker";
    case "rainbow_mania":
      return "Rainbow Mania";
    default:
      return gameType.charAt(0).toUpperCase() + gameType.slice(1);
  }
}
