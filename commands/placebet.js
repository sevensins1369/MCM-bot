// commands/placebet.js
const { SlashCommandBuilder } = require("discord.js");
const parseAmount = require("../utils/parseAmount");
const { getDuel, addBet } = require("../utils/DuelManager");
const { EMOJIS, formatAmount } = require("../utils/embedcreator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("placebet")
    .setDescription("Place a bet for a user (Host/Admin only).")
    .addUserOption((option) =>
      option
        .setName("player")
        .setDescription("The user to place the bet for.")
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("host")
        .setDescription("The host of the duel.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("currency")
        .setDescription("The currency of the bet.")
        .setRequired(true)
        .addChoices(
          { name: "07", value: "osrs" },
          { name: "RS3", value: "rs3" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("amount")
        .setDescription("The amount of the bet (e.g., 10k, 5m).")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("duel_type")
        .setDescription("Type of duel")
        .setRequired(true)
        .addChoices(
          { name: "Whip", value: "whip" },
          { name: "Boxing", value: "boxing" }
        )
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const player = interaction.options.getUser("player");
      const host = interaction.options.getUser("host");
      const currency = interaction.options.getString("currency");
      const rawAmount = interaction.options.getString("amount");
      const duelType = interaction.options.getString("duel_type");
      console.log(
        `[EXECUTE] /placebet by ${interaction.user.tag} for ${player.tag} on ${host.tag}`
      );

      const isHost = interaction.member.roles.cache.has(
        process.env.HOST_ROLE_ID
      );
      const isAdmin = interaction.member.permissions.has("Administrator");
      if (!isHost && !isAdmin) {
        return interaction.editReply({
          content: "❌ You do not have permission to use this command.",
        });
      }

      const amount = parseAmount(rawAmount); // Returns BigInt
      if (amount <= 0n) {
        return interaction.editReply({ content: "❌ Invalid amount format." });
      }

      if (host.id === player.id) {
        return interaction.editReply({
          content: "❌ A player cannot bet on themselves.",
        });
      }

      const hostDuel = await getDuel(host.id);
      if (!hostDuel || hostDuel.duelType !== duelType) {
        return interaction.editReply({
          content: `❌ ${host.username} doesn't have an active ${duelType} duel.`,
        });
      }

      if (hostDuel.betsOpen === false) {
        return interaction.editReply({
          content: `❌ Betting is closed for ${host.username}'s ${duelType} duel.`,
        });
      }

      const bet = {
        playerId: player.id,
        // --- BIGINT UPDATE: Ensure amount is stored as a string ---
        amount: amount.toString(),
        currency: currency,
        timestamp: new Date(),
      };

      await addBet(hostDuel._id, bet);

      await interaction.editReply({
        content: `${
          EMOJIS.bet
        } ${interaction.user.toString()} has placed a free bet of **${formatAmount(
          amount
        )} ${currency.toUpperCase()}** on ${host.toString()}'s ${duelType} duel for ${player.toString()}!`,
      });
      console.log(
        `HOST ACTION: ${interaction.user.username} placed a free bet of ${rawAmount} for ${player.username} on ${host.username}.`
      );
    } catch (error) {
      console.error("Error in /placebet command:", error);
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: `❌ An error occurred: ${error.message}`,
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      if (args.length < 5) {
        return message.reply(
          "❌ Invalid command usage. Format: `!placebet <player> <host> <currency> <amount> <duel_type>`"
        );
      }

      // Parse arguments
      const playerMention = args[0];
      const hostMention = args[1];
      const currency = args[2].toLowerCase();
      const rawAmount = args[3];
      const duelType = args[4].toLowerCase();

      // Validate currency
      if (currency !== "osrs" && currency !== "rs3") {
        return message.reply("❌ Invalid currency. Must be 'osrs' or 'rs3'.");
      }

      // Validate duel type
      if (duelType !== "whip" && duelType !== "boxing") {
        return message.reply(
          "❌ Invalid duel type. Must be 'whip' or 'boxing'."
        );
      }

      // Extract user IDs from mentions
      const playerId = playerMention.replace(/[<@!>]/g, "");
      const hostId = hostMention.replace(/[<@!>]/g, "");

      // Fetch users
      const player = await message.client.users
        .fetch(playerId)
        .catch(() => null);
      const host = await message.client.users.fetch(hostId).catch(() => null);

      if (!player || !host) {
        return message.reply(
          "❌ Invalid player or host mention. Please mention valid users."
        );
      }

      console.log(
        `[RUN] !placebet by ${message.author.tag} for ${player.tag} on ${host.tag}`
      );

      const isHost = message.member.roles.cache.has(process.env.HOST_ROLE_ID);
      const isAdmin = message.member.permissions.has("Administrator");
      if (!isHost && !isAdmin) {
        return message.reply(
          "❌ You do not have permission to use this command."
        );
      }

      const amount = parseAmount(rawAmount); // Returns BigInt
      if (amount <= 0n) {
        return message.reply("❌ Invalid amount format.");
      }

      if (host.id === player.id) {
        return message.reply("❌ A player cannot bet on themselves.");
      }

      const hostDuel = await getDuel(host.id);
      if (!hostDuel || hostDuel.duelType !== duelType) {
        return message.reply(
          `❌ ${host.username} doesn't have an active ${duelType} duel.`
        );
      }

      if (hostDuel.betsOpen === false) {
        return message.reply(
          `❌ Betting is closed for ${host.username}'s ${duelType} duel.`
        );
      }

      const bet = {
        playerId: player.id,
        amount: amount.toString(),
        currency: currency,
        timestamp: new Date(),
      };

      await addBet(hostDuel._id, bet);

      await message.reply(
        `${
          EMOJIS.bet
        } ${message.author.toString()} has placed a free bet of **${formatAmount(
          amount
        )} ${currency.toUpperCase()}** on ${host.toString()}'s ${duelType} duel for ${player.toString()}!`
      );
      console.log(
        `HOST ACTION: ${message.author.username} placed a free bet of ${rawAmount} for ${player.username} on ${host.username}.`
      );
    } catch (error) {
      console.error("Error in !placebet command:", error);
      await message.reply(`❌ An error occurred: ${error.message}`);
    }
  },
};

// This command allows hosts or admins to place a bet for a user on an active duel.
// It checks permissions, validates inputs, and updates the bet accordingly.
