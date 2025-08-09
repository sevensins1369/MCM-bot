// commands/bet.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getWallet, updateWallet } = require("../utils/WalletManager");
const { getDuel, addBetToDuel } = require("../utils/DuelManager");
const { formatAmount, EMOJIS } = require("../utils/embedcreator");
const { parseAmount } = require("../utils/amountParser");
const { getDefaultCurrency } = require("../utils/UserPreferencesManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bet")
    .setDescription("Place a bet on a duel.")
    .addUserOption((option) =>
      option
        .setName("player") // Changed from "host" to "player" for clarity
        .setDescription("The player to bet on (either host or opponent).")
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
        .setName("duel_type")
        .setDescription("The type of duel.")
        .setRequired(true)
        .addChoices(
          { name: "Whip", value: "whip" },
          { name: "Poly", value: "poly" }
        )
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

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const bettingPlayer = interaction.user;
      const taggedPlayer = interaction.options.getUser("player");
      const rawAmount = interaction.options.getString("amount");
      let currency = interaction.options.getString("currency");
      const duelType = interaction.options.getString("duel_type");

      if (bettingPlayer.id === taggedPlayer.id) {
        return interaction.editReply({
          content: "❌ You cannot bet on yourself.",
        });
      }

      // This now finds the duel if the tagged player is the host OR the opponent
      const duel = await getDuel(taggedPlayer.id);
      if (!duel) {
        return interaction.editReply({
          content: `❌ ${taggedPlayer.username} is not in an active duel.`,
        });
      }

      if (!duel.isOpen) {
        return interaction.editReply({
          content: "❌ This duel is not open for betting.",
        });
      }

      if (duel.type.toLowerCase() !== duelType.toLowerCase()) {
        return interaction.editReply({
          content: `❌ This is a ${duel.type} duel, not a ${duelType} duel.`,
        });
      }

      if (duelType.toLowerCase() === "whip") {
        currency = "osrs";
      } else if (duelType.toLowerCase() === "poly") {
        currency = "rs3";
      } else if (!currency) {
        currency = await getDefaultCurrency(bettingPlayer.id);
      }

      const parsedAmount = parseAmount(rawAmount);
      if (parsedAmount.error) {
        return interaction.editReply({ content: `❌ ${parsedAmount.error}` });
      }
      const amount = parsedAmount.value;

      if (amount <= 0n) {
        return interaction.editReply({
          content: "❌ Bet amount must be greater than 0.",
        });
      }

      const playerWallet = await getWallet(bettingPlayer.id);
      if (BigInt(playerWallet[currency]) < amount) {
        return interaction.editReply({
          content: `❌ You don't have enough ${currency.toUpperCase()} to bet.`,
        });
      }

      // Determine which side the bet is on
      const betSide = taggedPlayer.id === duel.hostId ? "host" : "opponent";

      // Deduct from wallet
      playerWallet[currency] = BigInt(playerWallet[currency]) - amount;
      await updateWallet(bettingPlayer.id, {
        [currency]: playerWallet[currency].toString(),
      });

      // Add bet to the duel, using the initiator's ID (duel.hostId) to find the record
      const bet = {
        playerId: bettingPlayer.id,
        playerName: bettingPlayer.username,
        amount: amount.toString(),
        currency: currency,
        timestamp: new Date(),
        side: betSide,
      };
      await addBetToDuel(duel.hostId, bet);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(`${EMOJIS.bet} Bet Placed Successfully`)
        .setDescription(
          `You bet ${formatAmount(amount)} ${currency.toUpperCase()} on **${
            taggedPlayer.username
          }** in the ${duelType} duel.`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in /bet command:", error);
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: `❌ An error occurred: ${error.message}`,
        ephemeral: true,
      });
    }
  },

  async run(message, args) {
    try {
      if (args.length < 3) {
        return message.reply(
          "❌ Invalid usage. Format: `!bet <@player> <amount> <duel_type>`"
        );
      }

      const bettingPlayer = message.author;
      const playerMention = args[0];
      const taggedPlayerId = playerMention.replace(/[<@!>]/g, "");
      const taggedPlayer = await message.client.users
        .fetch(taggedPlayerId)
        .catch(() => null);

      if (!taggedPlayer) {
        return message.reply("❌ Invalid player. Please mention a valid user.");
      }

      const rawAmount = args[1];
      const duelType = args[2].toLowerCase();

      if (bettingPlayer.id === taggedPlayer.id) {
        return message.reply("❌ You cannot bet on yourself.");
      }

      const duel = await getDuel(taggedPlayer.id);
      if (!duel) {
        return message.reply(
          `❌ ${taggedPlayer.username} is not in an active duel.`
        );
      }

      if (!duel.isOpen) {
        return message.reply("❌ This duel is not open for betting.");
      }

      if (duel.type.toLowerCase() !== duelType.toLowerCase()) {
        return message.reply(
          `❌ This is a ${duel.type} duel, not a ${duelType} duel.`
        );
      }

      let currency;
      if (duelType === "whip") {
        currency = "osrs";
      } else if (duelType === "poly") {
        currency = "rs3";
      } else {
        currency = await getDefaultCurrency(bettingPlayer.id);
      }

      const parsedAmount = parseAmount(rawAmount);
      if (parsedAmount.error) {
        return message.reply(`❌ ${parsedAmount.error}`);
      }
      const amount = parsedAmount.value;

      if (amount <= 0n) {
        return message.reply("❌ Bet amount must be greater than 0.");
      }

      const playerWallet = await getWallet(bettingPlayer.id);
      if (BigInt(playerWallet[currency]) < amount) {
        return message.reply(
          `❌ You don't have enough ${currency.toUpperCase()} to bet.`
        );
      }

      const betSide = taggedPlayer.id === duel.hostId ? "host" : "opponent";

      playerWallet[currency] = BigInt(playerWallet[currency]) - amount;
      await updateWallet(bettingPlayer.id, {
        [currency]: playerWallet[currency].toString(),
      });

      const bet = {
        playerId: bettingPlayer.id,
        playerName: bettingPlayer.username,
        amount: amount.toString(),
        currency: currency,
        timestamp: new Date(),
        side: betSide,
      };
      await addBetToDuel(duel.hostId, bet);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(`${EMOJIS.bet} Bet Placed Successfully`)
        .setDescription(
          `You bet ${formatAmount(amount)} ${currency.toUpperCase()} on **${
            taggedPlayer.username
          }** in the ${duelType} duel.`
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in !bet command:", error);
      await message.reply(`❌ An error occurred: ${error.message}`);
    }
  },

  aliases: ["b"],
};
