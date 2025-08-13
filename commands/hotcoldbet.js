// commands/hotcoldbet.js
// Command to place a bet on a Hot/Cold game

const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { getWallet, updateWallet } = require("../utils/WalletManager");
const { formatAmount, EMOJIS } = require("../utils/embedcreator");
const { getDefaultCurrency } = require("../utils/UserPreferencesManager");
const {
  ValidationError,
  withErrorHandling,
} = require("../utils/error-handler");
const HotColdManager = require("../utils/HotColdManager");

module.exports = {
  // Slash command definition
  data: new SlashCommandBuilder()
    .setName("hotcoldbet")
    .setDescription("Place a bet on a Hot/Cold game")
    .addUserOption((option) =>
      option
        .setName("host")
        .setDescription("The host of the Hot/Cold game")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("bet_type")
        .setDescription("What you want to bet on")
        .setRequired(true)
        .addChoices(
          { name: "HOT", value: "hot" },
          { name: "COLD", value: "cold" },
          { name: "Red", value: "red" },
          { name: "Orange", value: "orange" },
          { name: "Yellow", value: "yellow" },
          { name: "Black", value: "black" },
          { name: "Blue", value: "blue" },
          { name: "Green", value: "green" },
          { name: "Purple", value: "purple" },
          { name: "White", value: "white" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("amount")
        .setDescription("The amount to bet")
        .setRequired(true)
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
    await interaction.deferReply({ ephemeral: true });

    // Get options
    const host = interaction.options.getUser("host");
    const betType = interaction.options.getString("bet_type");
    const amountStr = interaction.options.getString("amount");
    const currencyOption = interaction.options.getString("currency");

    // Get user's default currency if not specified
    const currency =
      currencyOption || (await getDefaultCurrency(interaction.user.id));

    // Parse amount
    const { parseAmount } = require("../utils/amountParser");
    const parsedAmount = parseAmount(amountStr);
    if (parsedAmount.error) {
      throw new ValidationError(parsedAmount.error);
    }

    const amount = parsedAmount.value;

    // Get user's wallet
    const wallet = await getWallet(interaction.user.id);

    // Check if user has enough funds
    const walletBalance = BigInt(wallet[currency] || 0);
    if (walletBalance < amount) {
      throw new ValidationError(
        `You don't have enough ${currency.toUpperCase()} for this bet.`
      );
    }

    // Get the game
    const game = HotColdManager.getActiveGame(host.id);
    if (!game) {
      throw new ValidationError(
        `${host.username} does not have an active Hot/Cold game.`
      );
    }

    // Check if betting is open
    if (!game.isOpen) {
      throw new ValidationError("Betting is closed for this Hot/Cold game.");
    }

    // Check if user is trying to bet on their own game
    if (interaction.user.id === host.id) {
      throw new ValidationError("You cannot bet on your own Hot/Cold game.");
    }

    // Validate bet type
    if (!HotColdManager.VALID_BET_TYPES.includes(betType)) {
      throw new ValidationError(
        `Invalid bet type. Valid types: ${HotColdManager.VALID_BET_TYPES.join(
          ", "
        )}`
      );
    }

    // Deduct amount from wallet
    wallet[currency] = (walletBalance - amount).toString();
    await updateWallet(interaction.user.id, wallet);

    // Place bet
    await HotColdManager.placeBet(host.id, {
      playerId: interaction.user.id,
      betType,
      amount: amount.toString(),
      currency,
    });

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(
        `${EMOJIS.fire || "🔥"} Hot/Cold Bet Placed ${EMOJIS.snowflake || "❄️"}`
      )
      .setColor(0xff5733)
      .setDescription(`You placed a bet on ${host.username}'s Hot/Cold game.`)
      .addFields(
        { name: "Bet Type", value: formatBetType(betType), inline: true },
        {
          name: "Amount",
          value: `${formatAmount(amount)} ${currency.toUpperCase()}`,
          inline: true,
        },
        {
          name: "Potential Payout",
          value: calculatePotentialPayout(betType, amount),
          inline: true,
        }
      )
      .setFooter({ text: "Good luck!" })
      .setTimestamp();

    // Send embed
    await interaction.editReply({
      embeds: [embed],
      ephemeral: true,
    });

    // Send notification to the channel (non-ephemeral)
    const publicEmbed = new EmbedBuilder()
      .setColor(0xff5733)
      .setDescription(
        `${interaction.user.toString()} placed a ${formatBetType(
          betType
        )} bet on ${host.toString()}'s Hot/Cold game.`
      );

    await interaction.channel.send({ embeds: [publicEmbed] });
  }, "HotColdBetCommand"),

  // Prefix command execution
  async run(message, args) {
    try {
      // Check arguments
      if (args.length < 3) {
        throw new ValidationError(
          "Usage: !hotcoldbet <host> <bet_type> <amount> [currency]"
        );
      }

      // Get arguments
      const hostId = args[0].replace(/[<@!>]/g, "");
      const betType = args[1].toLowerCase();
      const amountStr = args[2];
      const currencyOption = args[3] ? args[3].toLowerCase() : null;

      // Get user's default currency if not specified
      const currency =
        currencyOption || (await getDefaultCurrency(message.author.id));

      // Parse amount
      const { parseAmount } = require("../utils/amountParser");
      const parsedAmount = parseAmount(amountStr);
      if (parsedAmount.error) {
        throw new ValidationError(parsedAmount.error);
      }

      const amount = parsedAmount.value;

      // Get user's wallet
      const wallet = await getWallet(message.author.id);

      // Check if user has enough funds
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

      // Get the game
      const game = HotColdManager.getActiveGame(host.id);
      if (!game) {
        throw new ValidationError(
          `${host.user.username} does not have an active Hot/Cold game.`
        );
      }

      // Check if betting is open
      if (!game.isOpen) {
        throw new ValidationError("Betting is closed for this Hot/Cold game.");
      }

      // Check if user is trying to bet on their own game
      if (message.author.id === host.id) {
        throw new ValidationError("You cannot bet on your own Hot/Cold game.");
      }

      // Validate bet type
      if (!HotColdManager.VALID_BET_TYPES.includes(betType)) {
        throw new ValidationError(
          `Invalid bet type. Valid types: ${HotColdManager.VALID_BET_TYPES.join(
            ", "
          )}`
        );
      }

      // Deduct amount from wallet
      wallet[currency] = (walletBalance - amount).toString();
      await updateWallet(message.author.id, wallet);

      // Place bet
      await HotColdManager.placeBet(host.id, {
        playerId: message.author.id,
        betType,
        amount: amount.toString(),
        currency,
      });

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(
          `${EMOJIS.fire || "🔥"} Hot/Cold Bet Placed ${
            EMOJIS.snowflake || "❄️"
          }`
        )
        .setColor(0xff5733)
        .setDescription(
          `You placed a bet on ${host.user.username}'s Hot/Cold game.`
        )
        .addFields(
          { name: "Bet Type", value: formatBetType(betType), inline: true },
          {
            name: "Amount",
            value: `${formatAmount(amount)} ${currency.toUpperCase()}`,
            inline: true,
          },
          {
            name: "Potential Payout",
            value: calculatePotentialPayout(betType, amount),
            inline: true,
          }
        )
        .setFooter({ text: "Good luck!" })
        .setTimestamp();

      // Send embed
      await message.reply({
        embeds: [embed],
      });

      // Send notification to the channel
      const publicEmbed = new EmbedBuilder()
        .setColor(0xff5733)
        .setDescription(
          `${message.author.toString()} placed a ${formatBetType(
            betType
          )} bet on ${host.toString()}'s Hot/Cold game.`
        );

      await message.channel.send({ embeds: [publicEmbed] });
    } catch (error) {
      // Handle errors for prefix command
      if (error instanceof ValidationError) {
        await message.reply(`⚠️ ${error.message}`);
      } else {
        console.error("Error in !hotcoldbet command:", error);
        await message.reply("❌ An error occurred while placing your bet.");
      }
    }
  },

  // Command aliases
  aliases: ["hcb"],
};

// Helper function to format bet type
function formatBetType(betType) {
  if (betType === "hot") return "🔥 HOT";
  if (betType === "cold") return "❄️ COLD";
  return betType.charAt(0).toUpperCase() + betType.slice(1);
}

// Helper function to calculate potential payout
function calculatePotentialPayout(betType, amount) {
  const multiplier = ["hot", "cold"].includes(betType) ? 1.85 : 5;
  const payout = Number(amount) * multiplier;
  return `${formatAmount(BigInt(Math.floor(payout)))} (${multiplier}x)`;
}
