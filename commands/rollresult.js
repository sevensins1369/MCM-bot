// commands/rollresult.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  getActiveDiceGame,
  completeDiceGame,
  getWinnersFromDiceGame,
  addRollToHistory,
  startDiceGame,
} = require("../utils/DiceManager");
const { updatePlayerStats } = require("../utils/PlayerStatsManager");
const { formatAmount, EMOJIS } = require("../utils/embedcreator");
const { logger } = require("../utils/enhanced-logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rollresult")
    .setDescription("Submit the result of a dice roll.")
    .addIntegerOption((option) =>
      option
        .setName("roll")
        .setDescription("The roll result (1-100).")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const hostId = interaction.user.id;
      const roll = interaction.options.getInteger("roll");

      // Check if user is a host
      const isHost = interaction.member.roles.cache.has(
        process.env.HOST_ROLE_ID
      );
      const isAdmin = interaction.member.permissions.has("Administrator");

      if (!isHost && !isAdmin) {
        return interaction.editReply({
          content: "❌ You do not have permission to use this command.",
        });
      }

      // Get the dice game
      const game = getActiveDiceGame(hostId);
      if (!game) {
        return interaction.editReply({
          content: "❌ You don't have an active dice table.",
        });
      }

      // Add roll to history
      await addRollToHistory(hostId, roll);

      // Get winners before completing the game
      const winners = getWinnersFromDiceGame(hostId, roll);

      // Complete the dice game
      const result = await completeDiceGame(hostId, roll);

      if (!result.success) {
        return interaction.editReply({ content: `❌ ${result.message}` });
      }

      // Update host stats
      try {
        await updatePlayerStats(hostId, {
          diceGamesHosted: 1,
        });
      } catch (statsError) {
        logger.error("RollResult", "Error updating player stats", statsError);
        // Continue even if stats update fails
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(0x9c27b0)
        .setTitle(`${EMOJIS.dice} Dice Roll Result: ${roll}`)
        .setDescription(`${interaction.user.toString()} rolled a **${roll}**!`)
        .setTimestamp();

      // Add fields for bets if there are any
      if (result.bets && result.bets.length > 0) {
        const totalOsrs = result.bets
          .filter((b) => b.currency === "osrs")
          .reduce((sum, bet) => sum + BigInt(bet.amount), 0n);
        const totalRs3 = result.bets
          .filter((b) => b.currency === "rs3")
          .reduce((sum, bet) => sum + BigInt(bet.amount), 0n);

        if (totalOsrs > 0n) {
          embed.addFields({
            name: "Total osrs Bets",
            value: formatAmount(totalOsrs),
            inline: true,
          });
        }

        if (totalRs3 > 0n) {
          embed.addFields({
            name: "Total RS3 Bets",
            value: formatAmount(totalRs3),
            inline: true,
          });
        }
      }

      await interaction.editReply({ embeds: [embed] });

      // Send winner notifications
      if (winners && winners.length > 0) {
        let winnerMessages = [];

        for (const winner of winners) {
          let winMessage = `<@${winner.playerId}> wins `;

          if (winner.osrsWinnings > 0n) {
            winMessage += `${formatAmount(winner.osrsWinnings)} osrs`;
          }

          if (winner.rs3Winnings > 0n) {
            if (winner.osrsWinnings > 0n) winMessage += " and ";
            winMessage += `${formatAmount(winner.rs3Winnings)} RS3`;
          }

          winMessage += ` on dice roll!`;
          winnerMessages.push(winMessage);
        }

        // Send winner messages in chunks to avoid hitting message length limits
        const chunkSize = 5;
        for (let i = 0; i < winnerMessages.length; i += chunkSize) {
          const chunk = winnerMessages.slice(i, i + chunkSize);
          await interaction.channel.send(chunk.join("\n"));
        }
      }

      // Automatically open a new dice table for the next round
      try {
        const newGameResult = await startDiceGame(hostId);
        if (newGameResult.success) {
          await interaction.channel.send(
            `${interaction.user.toString()} is now taking bets for the next roll!`
          );
        }
      } catch (newGameError) {
        logger.error(
          "RollResult",
          "Error creating new dice game",
          newGameError
        );
        // Don't stop execution if creating a new game fails
      }
    } catch (error) {
      logger.error("RollResult", "Error in rollresult command", error);
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: "❌ An error occurred while processing the roll result.",
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      if (args.length < 1) {
        return message.reply(
          "❌ Please specify a roll result. Format: `!rollresult <roll>` or `!rr <roll>`"
        );
      }

      const hostId = message.author.id;
      const roll = parseInt(args[0]);

      // Check if user is a host
      const isHost = message.member.roles.cache.has(process.env.HOST_ROLE_ID);
      const isAdmin = message.member.permissions.has("Administrator");

      if (!isHost && !isAdmin) {
        return message.reply(
          "❌ You do not have permission to use this command."
        );
      }

      // Validate roll
      if (isNaN(roll) || roll < 1 || roll > 100) {
        return message.reply("❌ Roll must be a number between 1 and 100.");
      }

      // Get the dice game
      const game = getActiveDiceGame(hostId);
      if (!game) {
        return message.reply("❌ You don't have an active dice table.");
      }

      // Add roll to history
      await addRollToHistory(hostId, roll);

      // Get winners before completing the game
      const winners = getWinnersFromDiceGame(hostId, roll);

      // Complete the dice game
      const result = await completeDiceGame(hostId, roll);

      if (!result.success) {
        return message.reply(`❌ ${result.message}`);
      }

      // Update host stats
      try {
        await updatePlayerStats(hostId, {
          diceGamesHosted: 1,
        });
      } catch (statsError) {
        logger.error("RollResult", "Error updating player stats", statsError);
        // Continue even if stats update fails
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(0x9c27b0)
        .setTitle(`${EMOJIS.dice} Dice Roll Result: ${roll}`)
        .setDescription(`${message.author.toString()} rolled a **${roll}**!`)
        .setTimestamp();

      // Add fields for bets if there are any
      if (result.bets && result.bets.length > 0) {
        const totalOsrs = result.bets
          .filter((b) => b.currency === "osrs")
          .reduce((sum, bet) => sum + BigInt(bet.amount), 0n);
        const totalRs3 = result.bets
          .filter((b) => b.currency === "rs3")
          .reduce((sum, bet) => sum + BigInt(bet.amount), 0n);

        if (totalOsrs > 0n) {
          embed.addFields({
            name: "Total osrs Bets",
            value: formatAmount(totalOsrs),
            inline: true,
          });
        }

        if (totalRs3 > 0n) {
          embed.addFields({
            name: "Total RS3 Bets",
            value: formatAmount(totalRs3),
            inline: true,
          });
        }
      }

      await message.reply({ embeds: [embed] });

      // Send winner notifications
      if (winners && winners.length > 0) {
        let winnerMessages = [];

        for (const winner of winners) {
          let winMessage = `<@${winner.playerId}> wins `;

          if (winner.osrsWinnings > 0n) {
            winMessage += `${formatAmount(winner.osrsWinnings)} osrs`;
          }

          if (winner.rs3Winnings > 0n) {
            if (winner.osrsWinnings > 0n) winMessage += " and ";
            winMessage += `${formatAmount(winner.rs3Winnings)} RS3`;
          }

          winMessage += ` on dice roll!`;
          winnerMessages.push(winMessage);
        }

        // Send winner messages in chunks to avoid hitting message length limits
        const chunkSize = 5;
        for (let i = 0; i < winnerMessages.length; i += chunkSize) {
          const chunk = winnerMessages.slice(i, i + chunkSize);
          await message.channel.send(chunk.join("\n"));
        }
      }

      // Automatically open a new dice table for the next round
      try {
        const newGameResult = await startDiceGame(hostId);
        if (newGameResult.success) {
          await message.channel.send(
            `${message.author.toString()} is now taking bets for the next roll!`
          );
        }
      } catch (newGameError) {
        logger.error(
          "RollResult",
          "Error creating new dice game",
          newGameError
        );
        // Don't stop execution if creating a new game fails
      }
    } catch (error) {
      logger.error("RollResult", "Error in rollresult command", error);
      await message.reply(
        "❌ An error occurred while processing the roll result."
      );
    }
  },

  // Command aliases
  aliases: ["rr"],
};
