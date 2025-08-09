// commands/loss.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getDuel, endDuel } = require("../utils/DuelManager");
const {
  getPlayerStats,
  addDuelToHistory,
  debugStats,
} = require("../utils/PlayerStatsManager");
const { getWallet, updateWallet } = require("../utils/WalletManager");
const { formatAmount, EMOJIS } = require("../utils/embedcreator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("loss")
    .setDescription("Declare that you lost your duel (Host only)."),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const user = interaction.user;
      const isHost = interaction.member.roles.cache.has(
        process.env.HOST_ROLE_ID
      );
      const isAdmin = interaction.member.permissions.has("Administrator");

      if (!isHost && !isAdmin) {
        return interaction.editReply({
          content: "❌ You do not have permission to use this command.",
        });
      }

      const duel = await getDuel(user.id);
      if (!duel) {
        return interaction.editReply({
          content: "❌ You do not have an active duel.",
        });
      }

      // Update host stats - DIRECT FIX FOR DUEL STATS
      try {
        // Get current stats
        const playerStats = await getPlayerStats(user.id);

        // Directly increment the duel stats
        playerStats.duelsLost = (playerStats.duelsLost || 0) + 1;
        playerStats.duelsHosted = (playerStats.duelsHosted || 0) + 1;

        // Update the cache
        const { statsCache } = require("../utils/PlayerStatsManager");
        statsCache.set(user.id, playerStats);

        // Save to storage
        const { saveStats } = require("../utils/PlayerStatsManager");
        saveStats();

        console.log(
          `Updated duel stats for ${user.id}: Lost=${playerStats.duelsLost}, Hosted=${playerStats.duelsHosted}`
        );

        // Debug stats
        debugStats(user.id);
      } catch (error) {
        console.error("Error updating duel stats:", error);
      }

      // Add to duel history
      await addDuelToHistory(user.id, {
        type: duel.type,
        result: "loss",
        opponent: duel.opponentId || "Unknown",
        timestamp: new Date(),
      });

      // If there's an opponent, update their stats too
      if (duel.opponentId) {
        try {
          // Get opponent stats
          const opponentStats = await getPlayerStats(duel.opponentId);

          // Directly increment the duel stats
          opponentStats.duelsWon = (opponentStats.duelsWon || 0) + 1;

          // Update the cache
          const { statsCache } = require("../utils/PlayerStatsManager");
          statsCache.set(duel.opponentId, opponentStats);

          // Save to storage
          const { saveStats } = require("../utils/PlayerStatsManager");
          saveStats();

          console.log(
            `Updated duel stats for opponent ${duel.opponentId}: Won=${opponentStats.duelsWon}`
          );

          // Debug stats
          debugStats(duel.opponentId);
        } catch (error) {
          console.error("Error updating opponent duel stats:", error);
        }

        // Add to opponent's duel history
        await addDuelToHistory(duel.opponentId, {
          type: duel.type,
          result: "win",
          opponent: user.id,
          timestamp: new Date(),
        });
      }

      // Process bets - THIS IS THE CRITICAL FIX
      // When host declares loss, bettors who bet on opponent should win
      let totalOsrsLost = 0n;
      let totalRs3Lost = 0n;
      let winners = [];
      let losers = [];

      if (duel.bets && duel.bets.length > 0) {
        for (const bet of duel.bets) {
          try {
            const betAmount = BigInt(bet.amount);
            const playerWallet = await getWallet(bet.playerId);

            // If bet was on opponent (who won), pay them
            if (bet.side === "opponent") {
              // Winner gets 2x their bet
              playerWallet[bet.currency] += betAmount * 2n;
              await updateWallet(bet.playerId, playerWallet);

              // Track for stats
              winners.push({
                playerId: bet.playerId,
                playerName: bet.playerName,
                amount: betAmount.toString(),
                currency: bet.currency,
              });

              // Update totals
              if (bet.currency === "osrs") {
                totalOsrsLost += betAmount;
              } else if (bet.currency === "rs3") {
                totalRs3Lost += betAmount;
              }

              console.log(
                `Paid ${formatAmount(betAmount * 2n)} ${bet.currency} to ${
                  bet.playerName
                } (bet on opponent)`
              );
            } else {
              // Bet was on host (who lost) - no payout
              losers.push({
                playerId: bet.playerId,
                playerName: bet.playerName,
                amount: betAmount.toString(),
                currency: bet.currency,
              });

              console.log(
                `No payout for ${bet.playerName} (bet on host who lost)`
              );
            }
          } catch (error) {
            console.error(`Failed to process bet for ${bet.playerId}:`, error);
          }
        }
      }

      // Create our own loss embed
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${EMOJIS.loss || "❌"} Duel Result: LOSS`)
        .setDescription(`${user.toString()} has lost their ${duel.type} duel.`)
        .setTimestamp();

      // Add fields for bets if there are any
      if (totalOsrsLost > 0n) {
        embed.addFields({
          name: "Total 07 Lost",
          value: formatAmount(totalOsrsLost),
          inline: true,
        });
      }

      if (totalRs3Lost > 0n) {
        embed.addFields({
          name: "Total RS3 Lost",
          value: formatAmount(totalRs3Lost),
          inline: true,
        });
      }

      await interaction.editReply({
        content: `${EMOJIS.loss || "❌"} You've declared a loss for your ${
          duel.type
        } duel!`,
        embeds: [embed],
      });

      // Send winner notifications
      if (winners.length > 0) {
        let winnerMessages = [];

        for (const winner of winners) {
          let winMessage = `<@${winner.playerId}> wins ${formatAmount(
            BigInt(winner.amount) * 2n
          )} ${winner.currency.toUpperCase()} in ${duel.type} duel!`;
          winnerMessages.push(winMessage);
        }

        // Send winner messages in chunks to avoid hitting message length limits
        const chunkSize = 10;
        for (let i = 0; i < winnerMessages.length; i += chunkSize) {
          const chunk = winnerMessages.slice(i, i + chunkSize);
          await interaction.channel.send(chunk.join("\n"));
        }
      }

      // End the duel
      await endDuel(user.id);
    } catch (error) {
      console.error("Error in /loss command:", error);
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
      const user = message.author;
      const isHost = message.member.roles.cache.has(process.env.HOST_ROLE_ID);
      const isAdmin = message.member.permissions.has("Administrator");

      if (!isHost && !isAdmin) {
        return message.reply(
          "❌ You do not have permission to use this command."
        );
      }

      const duel = await getDuel(user.id);
      if (!duel) {
        return message.reply("❌ You do not have an active duel.");
      }

      // Update host stats - DIRECT FIX FOR DUEL STATS
      try {
        // Get current stats
        const playerStats = await getPlayerStats(user.id);

        // Directly increment the duel stats
        playerStats.duelsLost = (playerStats.duelsLost || 0) + 1;
        playerStats.duelsHosted = (playerStats.duelsHosted || 0) + 1;

        // Update the cache
        const { statsCache } = require("../utils/PlayerStatsManager");
        statsCache.set(user.id, playerStats);

        // Save to storage
        const { saveStats } = require("../utils/PlayerStatsManager");
        saveStats();

        console.log(
          `Updated duel stats for ${user.id}: Lost=${playerStats.duelsLost}, Hosted=${playerStats.duelsHosted}`
        );

        // Debug stats
        debugStats(user.id);
      } catch (error) {
        console.error("Error updating duel stats:", error);
      }

      // Add to duel history
      await addDuelToHistory(user.id, {
        type: duel.type,
        result: "loss",
        opponent: duel.opponentId || "Unknown",
        timestamp: new Date(),
      });

      // If there's an opponent, update their stats too
      if (duel.opponentId) {
        try {
          // Get opponent stats
          const opponentStats = await getPlayerStats(duel.opponentId);

          // Directly increment the duel stats
          opponentStats.duelsWon = (opponentStats.duelsWon || 0) + 1;

          // Update the cache
          const { statsCache } = require("../utils/PlayerStatsManager");
          statsCache.set(duel.opponentId, opponentStats);

          // Save to storage
          const { saveStats } = require("../utils/PlayerStatsManager");
          saveStats();

          console.log(
            `Updated duel stats for opponent ${duel.opponentId}: Won=${opponentStats.duelsWon}`
          );

          // Debug stats
          debugStats(duel.opponentId);
        } catch (error) {
          console.error("Error updating opponent duel stats:", error);
        }

        // Add to opponent's duel history
        await addDuelToHistory(duel.opponentId, {
          type: duel.type,
          result: "win",
          opponent: user.id,
          timestamp: new Date(),
        });
      }

      // Process bets - THIS IS THE CRITICAL FIX
      // When host declares loss, bettors who bet on opponent should win
      let totalOsrsLost = 0n;
      let totalRs3Lost = 0n;
      let winners = [];
      let losers = [];

      if (duel.bets && duel.bets.length > 0) {
        for (const bet of duel.bets) {
          try {
            const betAmount = BigInt(bet.amount);
            const playerWallet = await getWallet(bet.playerId);

            // If bet was on opponent (who won), pay them
            if (bet.side === "opponent") {
              // Winner gets 2x their bet
              playerWallet[bet.currency] += betAmount * 2n;
              await updateWallet(bet.playerId, playerWallet);

              // Track for stats
              winners.push({
                playerId: bet.playerId,
                playerName: bet.playerName,
                amount: betAmount.toString(),
                currency: bet.currency,
              });

              // Update totals
              if (bet.currency === "osrs") {
                totalOsrsLost += betAmount;
              } else if (bet.currency === "rs3") {
                totalRs3Lost += betAmount;
              }

              console.log(
                `Paid ${formatAmount(betAmount * 2n)} ${bet.currency} to ${
                  bet.playerName
                } (bet on opponent)`
              );
            } else {
              // Bet was on host (who lost) - no payout
              losers.push({
                playerId: bet.playerId,
                playerName: bet.playerName,
                amount: betAmount.toString(),
                currency: bet.currency,
              });

              console.log(
                `No payout for ${bet.playerName} (bet on host who lost)`
              );
            }
          } catch (error) {
            console.error(`Failed to process bet for ${bet.playerId}:`, error);
          }
        }
      }

      // Create our own loss embed
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${EMOJIS.loss || "❌"} Duel Result: LOSS`)
        .setDescription(`${user.toString()} has lost their ${duel.type} duel.`)
        .setTimestamp();

      // Add fields for bets if there are any
      if (totalOsrsLost > 0n) {
        embed.addFields({
          name: "Total 07 Lost",
          value: formatAmount(totalOsrsLost),
          inline: true,
        });
      }

      if (totalRs3Lost > 0n) {
        embed.addFields({
          name: "Total RS3 Lost",
          value: formatAmount(totalRs3Lost),
          inline: true,
        });
      }

      await message.reply({
        content: `${EMOJIS.loss || "❌"} You've declared a loss for your ${
          duel.type
        } duel!`,
        embeds: [embed],
      });

      // Send winner notifications
      if (winners.length > 0) {
        let winnerMessages = [];

        for (const winner of winners) {
          let winMessage = `<@${winner.playerId}> wins ${formatAmount(
            BigInt(winner.amount) * 2n
          )} ${winner.currency.toUpperCase()} in ${duel.type} duel!`;
          winnerMessages.push(winMessage);
        }

        // Send winner messages in chunks to avoid hitting message length limits
        const chunkSize = 10;
        for (let i = 0; i < winnerMessages.length; i += chunkSize) {
          const chunk = winnerMessages.slice(i, i + chunkSize);
          await message.channel.send(chunk.join("\n"));
        }
      }

      // End the duel
      await endDuel(user.id);
    } catch (error) {
      console.error("Error in !loss command:", error);
      await message.reply(`❌ An error occurred: ${error.message}`);
    }
  },
};
