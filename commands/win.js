// commands/win.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  getDuel,
  completeDuel,
  getWinnersFromDuel,
} = require("../utils/DuelManager");
const {
  updatePlayerStats,
  getPlayerStats,
  addDuelToHistory,
  debugStats,
} = require("../utils/PlayerStatsManager");
const { updateWallet } = require("../utils/WalletManager");
const { formatAmount, EMOJIS } = require("../utils/embedcreator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("win")
    .setDescription("Declare yourself as the winner of your duel."),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const hostId = interaction.user.id;

      // Get the duel
      const duel = await getDuel(hostId);
      if (!duel) {
        return interaction.editReply({
          content: "❌ You don't have an active duel.",
        });
      }

      // Check if duel is already completed
      if (duel.isComplete) {
        return interaction.editReply({
          content: "❌ This duel has already been completed.",
        });
      }

      // Get winners before completing the duel
      const winners = await getWinnersFromDuel(hostId, "host");

      // Complete the duel with host as winner
      const result = await completeDuel(hostId, "host");

      if (!result.success) {
        return interaction.editReply({ content: `❌ ${result.message}` });
      }

      // Update host stats - DIRECT FIX FOR DUEL STATS
      try {
        // Get current stats
        const playerStats = await getPlayerStats(hostId);

        // Directly increment the duel stats
        playerStats.duelsWon = (playerStats.duelsWon || 0) + 1;
        playerStats.duelsHosted = (playerStats.duelsHosted || 0) + 1;

        // Update the cache
        const { statsCache } = require("../utils/PlayerStatsManager");
        statsCache.set(hostId, playerStats);

        // Save to storage
        const { saveStats } = require("../utils/PlayerStatsManager");
        saveStats();

        console.log(
          `Updated duel stats for ${hostId}: Won=${playerStats.duelsWon}, Hosted=${playerStats.duelsHosted}`
        );

        // Debug stats
        debugStats(hostId);
      } catch (error) {
        console.error("Error updating duel stats:", error);
      }

      // Add to duel history
      await addDuelToHistory(hostId, {
        type: duel.type,
        result: "win",
        opponent: duel.opponentId || "Unknown",
        timestamp: new Date(),
      });

      // If there's an opponent, update their stats too
      if (duel.opponentId) {
        try {
          // Get opponent stats
          const opponentStats = await getPlayerStats(duel.opponentId);

          // Directly increment the duel stats
          opponentStats.duelsLost = (opponentStats.duelsLost || 0) + 1;

          // Update the cache
          const { statsCache } = require("../utils/PlayerStatsManager");
          statsCache.set(duel.opponentId, opponentStats);

          // Save to storage
          const { saveStats } = require("../utils/PlayerStatsManager");
          saveStats();

          console.log(
            `Updated duel stats for opponent ${duel.opponentId}: Lost=${opponentStats.duelsLost}`
          );

          // Debug stats
          debugStats(duel.opponentId);
        } catch (error) {
          console.error("Error updating opponent duel stats:", error);
        }

        // Add to opponent's duel history
        await addDuelToHistory(duel.opponentId, {
          type: duel.type,
          result: "loss",
          opponent: hostId,
          timestamp: new Date(),
        });
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(`${EMOJIS.win} Duel Result: WIN`)
        .setDescription(
          `${interaction.user.toString()} has won their ${duel.type} duel!`
        )
        .setTimestamp();

      // Add fields for bets if there are any
      if (duel.bets && duel.bets.length > 0) {
        const totalOsrs = duel.bets
          .filter((b) => b.currency === "osrs")
          .reduce((sum, bet) => sum + BigInt(bet.amount), 0n);
        const totalRs3 = duel.bets
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
      if (winners.length > 0) {
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

          winMessage += ` in ${duel.type} duel!`;
          winnerMessages.push(winMessage);
        }

        // Send winner messages in chunks to avoid hitting message length limits
        const chunkSize = 10;
        for (let i = 0; i < winnerMessages.length; i += chunkSize) {
          const chunk = winnerMessages.slice(i, i + chunkSize);
          await interaction.channel.send(chunk.join("\n"));
        }
      }
    } catch (error) {
      console.error("Error in /win command:", error);
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: "❌ An error occurred while processing the win.",
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      const hostId = message.author.id;

      // Get the duel
      const duel = await getDuel(hostId);
      if (!duel) {
        return message.reply("❌ You don't have an active duel.");
      }

      // Check if duel is already completed
      if (duel.isComplete) {
        return message.reply("❌ This duel has already been completed.");
      }

      // Get winners before completing the duel
      const winners = await getWinnersFromDuel(hostId, "host");

      // Complete the duel with host as winner
      const result = await completeDuel(hostId, "host");

      if (!result.success) {
        return message.reply(`❌ ${result.message}`);
      }

      // Update host stats - DIRECT FIX FOR DUEL STATS
      try {
        // Get current stats
        const playerStats = await getPlayerStats(hostId);

        // Directly increment the duel stats
        playerStats.duelsWon = (playerStats.duelsWon || 0) + 1;
        playerStats.duelsHosted = (playerStats.duelsHosted || 0) + 1;

        // Update the cache
        const { statsCache } = require("../utils/PlayerStatsManager");
        statsCache.set(hostId, playerStats);

        // Save to storage
        const { saveStats } = require("../utils/PlayerStatsManager");
        saveStats();

        console.log(
          `Updated duel stats for ${hostId}: Won=${playerStats.duelsWon}, Hosted=${playerStats.duelsHosted}`
        );

        // Debug stats
        debugStats(hostId);
      } catch (error) {
        console.error("Error updating duel stats:", error);
      }

      // Add to duel history
      await addDuelToHistory(hostId, {
        type: duel.type,
        result: "win",
        opponent: duel.opponentId || "Unknown",
        timestamp: new Date(),
      });

      // If there's an opponent, update their stats too
      if (duel.opponentId) {
        try {
          // Get opponent stats
          const opponentStats = await getPlayerStats(duel.opponentId);

          // Directly increment the duel stats
          opponentStats.duelsLost = (opponentStats.duelsLost || 0) + 1;

          // Update the cache
          const { statsCache } = require("../utils/PlayerStatsManager");
          statsCache.set(duel.opponentId, opponentStats);

          // Save to storage
          const { saveStats } = require("../utils/PlayerStatsManager");
          saveStats();

          console.log(
            `Updated duel stats for opponent ${duel.opponentId}: Lost=${opponentStats.duelsLost}`
          );

          // Debug stats
          debugStats(duel.opponentId);
        } catch (error) {
          console.error("Error updating opponent duel stats:", error);
        }

        // Add to opponent's duel history
        await addDuelToHistory(duel.opponentId, {
          type: duel.type,
          result: "loss",
          opponent: hostId,
          timestamp: new Date(),
        });
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(`${EMOJIS.win} Duel Result: WIN`)
        .setDescription(
          `${message.author.toString()} has won their ${duel.type} duel!`
        )
        .setTimestamp();

      // Add fields for bets if there are any
      if (duel.bets && duel.bets.length > 0) {
        const totalOsrs = duel.bets
          .filter((b) => b.currency === "osrs")
          .reduce((sum, bet) => sum + BigInt(bet.amount), 0n);
        const totalRs3 = duel.bets
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
      if (winners.length > 0) {
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

          winMessage += ` in ${duel.type} duel!`;
          winnerMessages.push(winMessage);
        }

        // Send winner messages in chunks to avoid hitting message length limits
        const chunkSize = 10;
        for (let i = 0; i < winnerMessages.length; i += chunkSize) {
          const chunk = winnerMessages.slice(i, i + chunkSize);
          await message.channel.send(chunk.join("\n"));
        }
      }
    } catch (error) {
      console.error("Error in !win command:", error);
      await message.reply("❌ An error occurred while processing the win.");
    }
  },
};
