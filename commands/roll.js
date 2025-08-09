// commands/roll.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  getActiveDuelByPlayer,
  recordDiceRoll,
} = require("../utils/DiceDuelManager");
const { formatAmount, EMOJIS } = require("../utils/embedcreator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roll")
    .setDescription("Roll dice for your active dice duel."),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const player = interaction.user;

      // Check if player has an active duel
      const duel = getActiveDuelByPlayer(player.id);
      if (!duel) {
        return interaction.editReply({
          content: "❌ You don't have an active dice duel.",
        });
      }

      if (!duel.isAccepted) {
        return interaction.editReply({
          content: "❌ Your opponent hasn't accepted the duel yet.",
        });
      }

      // Generate a random roll (1-100)
      const roll = Math.floor(Math.random() * 100) + 1;

      // Record the roll
      const result = await recordDiceRoll(player.id, roll);

      if (!result.success) {
        return interaction.editReply({ content: `❌ ${result.message}` });
      }

      // Get the opponent
      const isChallenger = player.id === duel.challengerId;
      const opponentId = isChallenger ? duel.opponentId : duel.challengerId;

      let opponent;
      try {
        opponent = await interaction.client.users.fetch(opponentId);
      } catch (error) {
        console.error("Error fetching opponent:", error);
        opponent = { username: "Unknown", toString: () => "Unknown User" };
      }

      // Create embed for the roll
      const embed = new EmbedBuilder()
        .setColor(0x9c27b0)
        .setTitle(`${EMOJIS.dice} Dice Roll`)
        .setDescription(`${player.toString()} rolled **${roll}**!`)
        .setTimestamp();

      // Add fields based on whether both players have rolled
      if (result.bothRolled) {
        // Both players have rolled, show the result
        const challengerRoll = duel.challengerRoll;
        const opponentRoll = duel.opponentRoll;

        // Get challenger user
        let challenger;
        try {
          challenger = await interaction.client.users.fetch(duel.challengerId);
        } catch (error) {
          console.error("Error fetching challenger:", error);
          challenger = { username: "Unknown", toString: () => "Unknown User" };
        }

        embed.setTitle(`${EMOJIS.dice} Dice Duel Result`);
        embed.setDescription(
          `${challenger.toString()} vs ${opponent.toString()}`
        );
        embed.addFields(
          {
            name: challenger.username,
            value: `Rolled: **${challengerRoll}**`,
            inline: true,
          },
          {
            name: opponent.username,
            value: `Rolled: **${opponentRoll}**`,
            inline: true,
          },
          {
            name: "Bet Amount",
            value: `${formatAmount(
              BigInt(duel.amount)
            )} ${duel.currency.toUpperCase()}`,
            inline: true,
          }
        );

        // Add winner field
        if (duel.isTie) {
          embed.addFields({
            name: "Result",
            value: "It's a tie! Both players have been refunded.",
            inline: false,
          });
        } else {
          const winnerId =
            challengerRoll > opponentRoll ? duel.challengerId : duel.opponentId;
          const winner = winnerId === duel.challengerId ? challenger : opponent;
          embed.addFields({
            name: "Winner",
            value: winner.toString(),
            inline: false,
          });
        }
      } else {
        // Only one player has rolled
        const waitingFor = isChallenger
          ? opponent
          : await interaction.client.users.fetch(duel.challengerId);
        embed.addFields(
          { name: "Waiting for", value: waitingFor.toString(), inline: true },
          {
            name: "Bet Amount",
            value: `${formatAmount(
              BigInt(duel.amount)
            )} ${duel.currency.toUpperCase()}`,
            inline: true,
          }
        );
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in /roll command:", error);
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: `❌ An error occurred: ${error.message}`,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      const player = message.author;

      // Check if player has an active duel
      const duel = getActiveDuelByPlayer(player.id);
      if (!duel) {
        return message.reply("❌ You don't have an active dice duel.");
      }

      if (!duel.isAccepted) {
        return message.reply("❌ Your opponent hasn't accepted the duel yet.");
      }

      // Generate a random roll (1-100)
      const roll = Math.floor(Math.random() * 100) + 1;

      // Record the roll
      const result = await recordDiceRoll(player.id, roll);

      if (!result.success) {
        return message.reply(`❌ ${result.message}`);
      }

      // Get the opponent
      const isChallenger = player.id === duel.challengerId;
      const opponentId = isChallenger ? duel.opponentId : duel.challengerId;

      let opponent;
      try {
        opponent = await message.client.users.fetch(opponentId);
      } catch (error) {
        console.error("Error fetching opponent:", error);
        opponent = { username: "Unknown", toString: () => "Unknown User" };
      }

      // Create embed for the roll
      const embed = new EmbedBuilder()
        .setColor(0x9c27b0)
        .setTitle(`${EMOJIS.dice} Dice Roll`)
        .setDescription(`${player.toString()} rolled **${roll}**!`)
        .setTimestamp();

      // Add fields based on whether both players have rolled
      if (result.bothRolled) {
        // Both players have rolled, show the result
        const challengerRoll = duel.challengerRoll;
        const opponentRoll = duel.opponentRoll;

        // Get challenger user
        let challenger;
        try {
          challenger = await message.client.users.fetch(duel.challengerId);
        } catch (error) {
          console.error("Error fetching challenger:", error);
          challenger = { username: "Unknown", toString: () => "Unknown User" };
        }

        embed.setTitle(`${EMOJIS.dice} Dice Duel Result`);
        embed.setDescription(
          `${challenger.toString()} vs ${opponent.toString()}`
        );
        embed.addFields(
          {
            name: challenger.username,
            value: `Rolled: **${challengerRoll}**`,
            inline: true,
          },
          {
            name: opponent.username,
            value: `Rolled: **${opponentRoll}**`,
            inline: true,
          },
          {
            name: "Bet Amount",
            value: `${formatAmount(
              BigInt(duel.amount)
            )} ${duel.currency.toUpperCase()}`,
            inline: true,
          }
        );

        // Add winner field
        if (duel.isTie) {
          embed.addFields({
            name: "Result",
            value: "It's a tie! Both players have been refunded.",
            inline: false,
          });
        } else {
          const winnerId =
            challengerRoll > opponentRoll ? duel.challengerId : duel.opponentId;
          const winner = winnerId === duel.challengerId ? challenger : opponent;
          embed.addFields({
            name: "Winner",
            value: winner.toString(),
            inline: false,
          });
        }
      } else {
        // Only one player has rolled
        const waitingFor = isChallenger
          ? opponent
          : await message.client.users.fetch(duel.challengerId);
        embed.addFields(
          { name: "Waiting for", value: waitingFor.toString(), inline: true },
          {
            name: "Bet Amount",
            value: `${formatAmount(
              BigInt(duel.amount)
            )} ${duel.currency.toUpperCase()}`,
            inline: true,
          }
        );
      }

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in !roll command:", error);
      await message.reply(`❌ An error occurred: ${error.message}`);
    }
  },
};
