// commands/universal-refund.js
require("dotenv").config();
const { SlashCommandBuilder } = require("discord.js");
const { getDuel } = require("../utils/DuelManager");
const { getWallet, updateWallet } = require("../utils/WalletManager");
const { EMOJIS, formatAmount } = require("../utils/embedcreator");
const mongoose = require("mongoose");
const { getFlowerGame, cancelGame } = require("../utils/FlowerGameManager");
const { getActiveDuel, cancelDiceDuel } = require("../utils/DiceDuelManager");
const { getActiveHotColdGame } = require("../utils/HotColdManager");
const { getActiveDiceGame } = require("../utils/DiceManager");
const { logger } = require("../enhanced-logger");
const { withErrorHandling, ValidationError } = require("../utils/error-handler");

const HOST_ROLE_ID = process.env.HOST_ROLE_ID;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("universal-refund")
    .setDescription(
      "Process a refund for a player's bets across all active games (Host only)."
    )
    .addUserOption((option) =>
      option
        .setName("player")
        .setDescription("The player to refund.")
        .setRequired(true)
    ),

  execute: withErrorHandling(async function (interaction) {
    await interaction.deferReply({ ephemeral: true });
    const player = interaction.options.getUser("player");
    const host = interaction.user;
    logger.info("UniversalRefund", `Refund requested by ${host.tag} for ${player.tag}`);

    const isHost = interaction.member.roles.cache.has(HOST_ROLE_ID);
    const isAdmin = interaction.member.permissions.has("Administrator");
    if (!isHost && !isAdmin) {
      throw new ValidationError("Only hosts can process refunds.");
    }

    // Track refunds across all game types
    const refundResults = {
      duel: { success: false, amount: 0n, currency: "" },
      diceDuel: { success: false, amount: 0n, currency: "" },
      dice: { success: false, amount: 0n, currency: "" },
      flowerGame: { success: false, amount: 0n, currency: "" },
      hotCold: { success: false, amount: 0n, currency: "" },
      totalRefunded: 0n,
      currency: "",
      anyRefunded: false
    };

    // 1. Check for duel bets
    try {
      const duel = await getDuel(host.id);
      if (duel) {
        const playerBets = duel.bets
          ? duel.bets.filter((bet) => bet.playerId === player.id)
          : [];
        
        if (playerBets.length > 0) {
          const playerWallet = await getWallet(player.id);
          let totalRefunded = 0n;
          let refundCurrency = "";

          for (const bet of playerBets) {
            const betAmount = BigInt(bet.amount);
            playerWallet[bet.currency] += betAmount;
            totalRefunded += betAmount;
            refundCurrency = bet.currency;
          }

          await updateWallet(player.id, playerWallet);

          const Duel = mongoose.models.Duel;
          await Duel.updateOne(
            { _id: duel._id },
            { $pull: { bets: { playerId: player.id } } }
          );

          refundResults.duel = { 
            success: true, 
            amount: totalRefunded, 
            currency: refundCurrency 
          };
          refundResults.anyRefunded = true;
          
          if (!refundResults.currency) {
            refundResults.currency = refundCurrency;
            refundResults.totalRefunded = totalRefunded;
          } else if (refundResults.currency === refundCurrency) {
            refundResults.totalRefunded += totalRefunded;
          }
          
          logger.info("UniversalRefund", `Refunded duel bets for ${player.id}`, {
            amount: totalRefunded.toString(),
            currency: refundCurrency
          });
        }
      }
    } catch (error) {
      logger.error("UniversalRefund", "Error refunding duel bets", error);
    }

    // 2. Check for dice duel bets
    try {
      const diceDuel = getActiveDuel(host.id);
      if (diceDuel && (diceDuel.challengerId === player.id || diceDuel.opponentId === player.id)) {
        // For dice duels, we need to cancel the duel for the specific player
        if (diceDuel.challengerId === player.id) {
          const result = await cancelDiceDuel(player.id);
          if (result.success) {
            refundResults.diceDuel = { 
              success: true, 
              amount: BigInt(diceDuel.amount), 
              currency: diceDuel.currency 
            };
            refundResults.anyRefunded = true;
            
            if (!refundResults.currency) {
              refundResults.currency = diceDuel.currency;
              refundResults.totalRefunded = BigInt(diceDuel.amount);
            } else if (refundResults.currency === diceDuel.currency) {
              refundResults.totalRefunded += BigInt(diceDuel.amount);
            }
            
            logger.info("UniversalRefund", `Refunded dice duel for ${player.id}`, {
              amount: diceDuel.amount,
              currency: diceDuel.currency
            });
          }
        }
      }
    } catch (error) {
      logger.error("UniversalRefund", "Error refunding dice duel", error);
    }

    // 3. Check for dice game bets
    try {
      const diceGame = getActiveDiceGame(host.id);
      if (diceGame) {
        const playerBets = diceGame.bets
          ? diceGame.bets.filter((bet) => bet.playerId === player.id)
          : [];
        
        if (playerBets.length > 0) {
          const playerWallet = await getWallet(player.id);
          let totalRefunded = 0n;
          let refundCurrency = "";

          for (const bet of playerBets) {
            const betAmount = BigInt(bet.amount);
            playerWallet[bet.currency] += betAmount;
            totalRefunded += betAmount;
            refundCurrency = bet.currency;
          }

          await updateWallet(player.id, playerWallet);

          // Remove the player's bets from the dice game
          diceGame.bets = diceGame.bets.filter(bet => bet.playerId !== player.id);

          refundResults.dice = { 
            success: true, 
            amount: totalRefunded, 
            currency: refundCurrency 
          };
          refundResults.anyRefunded = true;
          
          if (!refundResults.currency) {
            refundResults.currency = refundCurrency;
            refundResults.totalRefunded = totalRefunded;
          } else if (refundResults.currency === refundCurrency) {
            refundResults.totalRefunded += totalRefunded;
          }
          
          logger.info("UniversalRefund", `Refunded dice game bets for ${player.id}`, {
            amount: totalRefunded.toString(),
            currency: refundCurrency
          });
        }
      }
    } catch (error) {
      logger.error("UniversalRefund", "Error refunding dice game bets", error);
    }

    // 4. Check for flower game bets
    try {
      const flowerGame = getFlowerGame(host.id);
      if (flowerGame) {
        const playerBets = flowerGame.bets
          ? flowerGame.bets.filter((bet) => bet.playerId === player.id)
          : [];
        
        if (playerBets.length > 0) {
          const playerWallet = await getWallet(player.id);
          let totalRefunded = 0n;
          let refundCurrency = "";

          for (const bet of playerBets) {
            const betAmount = BigInt(bet.amount);
            playerWallet[bet.currency] += betAmount;
            totalRefunded += betAmount;
            refundCurrency = bet.currency;
          }

          await updateWallet(player.id, playerWallet);

          // Remove the player's bets from the flower game
          flowerGame.bets = flowerGame.bets.filter(bet => bet.playerId !== player.id);

          refundResults.flowerGame = { 
            success: true, 
            amount: totalRefunded, 
            currency: refundCurrency 
          };
          refundResults.anyRefunded = true;
          
          if (!refundResults.currency) {
            refundResults.currency = refundCurrency;
            refundResults.totalRefunded = totalRefunded;
          } else if (refundResults.currency === refundCurrency) {
            refundResults.totalRefunded += totalRefunded;
          }
          
          logger.info("UniversalRefund", `Refunded flower game bets for ${player.id}`, {
            amount: totalRefunded.toString(),
            currency: refundCurrency
          });
        }
      }
    } catch (error) {
      logger.error("UniversalRefund", "Error refunding flower game bets", error);
    }

    // 5. Check for hot/cold game bets
    try {
      const hotColdGame = getActiveHotColdGame(host.id);
      if (hotColdGame) {
        const playerBets = hotColdGame.bets
          ? hotColdGame.bets.filter((bet) => bet.playerId === player.id)
          : [];
        
        if (playerBets.length > 0) {
          const playerWallet = await getWallet(player.id);
          let totalRefunded = 0n;
          let refundCurrency = "";

          for (const bet of playerBets) {
            const betAmount = BigInt(bet.amount);
            playerWallet[bet.currency] += betAmount;
            totalRefunded += betAmount;
            refundCurrency = bet.currency;
          }

          await updateWallet(player.id, playerWallet);

          // Remove the player's bets from the hot/cold game
          hotColdGame.bets = hotColdGame.bets.filter(bet => bet.playerId !== player.id);

          refundResults.hotCold = { 
            success: true, 
            amount: totalRefunded, 
            currency: refundCurrency 
          };
          refundResults.anyRefunded = true;
          
          if (!refundResults.currency) {
            refundResults.currency = refundCurrency;
            refundResults.totalRefunded = totalRefunded;
          } else if (refundResults.currency === refundCurrency) {
            refundResults.totalRefunded += totalRefunded;
          }
          
          logger.info("UniversalRefund", `Refunded hot/cold game bets for ${player.id}`, {
            amount: totalRefunded.toString(),
            currency: refundCurrency
          });
        }
      }
    } catch (error) {
      logger.error("UniversalRefund", "Error refunding hot/cold game bets", error);
    }

    // Generate response message
    if (refundResults.anyRefunded) {
      let responseMessage = `${EMOJIS.win} Successfully refunded ${player.toString()}'s bets:\n`;
      
      if (refundResults.duel.success) {
        responseMessage += `- Duel: **${formatAmount(refundResults.duel.amount)} ${refundResults.duel.currency.toUpperCase()}**\n`;
      }
      
      if (refundResults.diceDuel.success) {
        responseMessage += `- Dice Duel: **${formatAmount(refundResults.diceDuel.amount)} ${refundResults.diceDuel.currency.toUpperCase()}**\n`;
      }
      
      if (refundResults.dice.success) {
        responseMessage += `- Dice: **${formatAmount(refundResults.dice.amount)} ${refundResults.dice.currency.toUpperCase()}**\n`;
      }
      
      if (refundResults.flowerGame.success) {
        responseMessage += `- Flower Game: **${formatAmount(refundResults.flowerGame.amount)} ${refundResults.flowerGame.currency.toUpperCase()}**\n`;
      }
      
      if (refundResults.hotCold.success) {
        responseMessage += `- Hot/Cold: **${formatAmount(refundResults.hotCold.amount)} ${refundResults.hotCold.currency.toUpperCase()}**\n`;
      }
      
      responseMessage += `\nTotal refunded: **${formatAmount(refundResults.totalRefunded)} ${refundResults.currency.toUpperCase()}**`;
      
      await interaction.editReply({
        content: responseMessage,
      });

      try {
        await player.send({
          content: `${EMOJIS.win} Your bets have been refunded by ${host.toString()}. Total refund: **${formatAmount(refundResults.totalRefunded)} ${refundResults.currency.toUpperCase()}**`,
        });
      } catch (dmError) {
        logger.warn("UniversalRefund", `Could not DM ${player.username} about their refund.`);
      }
    } else {
      throw new ValidationError(`${player.username} does not have any active bets with you.`);
    }
  }, "UniversalRefundCommand"),

  // For prefix command usage
  async run(message, args) {
    try {
      if (args.length < 1) {
        return message.reply(
          "❌ Please specify a player to refund. Format: `!refund <player>`"
        );
      }

      const playerMention = args[0];
      const playerId = playerMention.replace(/[<@!>]/g, "");
      const player = await message.client.users
        .fetch(playerId)
        .catch(() => null);

      if (!player) {
        return message.reply(
          "❌ Invalid player mention. Please mention a valid user."
        );
      }

      const host = message.author;
      logger.info("UniversalRefund", `Refund requested by ${host.tag} for ${player.tag}`);

      const isHost = message.member.roles.cache.has(HOST_ROLE_ID);
      const isAdmin = message.member.permissions.has("Administrator");
      if (!isHost && !isAdmin) {
        return message.reply("❌ Only hosts can process refunds.");
      }

      // Track refunds across all game types
      const refundResults = {
        duel: { success: false, amount: 0n, currency: "" },
        diceDuel: { success: false, amount: 0n, currency: "" },
        dice: { success: false, amount: 0n, currency: "" },
        flowerGame: { success: false, amount: 0n, currency: "" },
        hotCold: { success: false, amount: 0n, currency: "" },
        totalRefunded: 0n,
        currency: "",
        anyRefunded: false
      };

      // 1. Check for duel bets
      try {
        const duel = await getDuel(host.id);
        if (duel) {
          const playerBets = duel.bets
            ? duel.bets.filter((bet) => bet.playerId === player.id)
            : [];
          
          if (playerBets.length > 0) {
            const playerWallet = await getWallet(player.id);
            let totalRefunded = 0n;
            let refundCurrency = "";

            for (const bet of playerBets) {
              const betAmount = BigInt(bet.amount);
              playerWallet[bet.currency] += betAmount;
              totalRefunded += betAmount;
              refundCurrency = bet.currency;
            }

            await updateWallet(player.id, playerWallet);

            const Duel = mongoose.models.Duel;
            await Duel.updateOne(
              { _id: duel._id },
              { $pull: { bets: { playerId: player.id } } }
            );

            refundResults.duel = { 
              success: true, 
              amount: totalRefunded, 
              currency: refundCurrency 
            };
            refundResults.anyRefunded = true;
            
            if (!refundResults.currency) {
              refundResults.currency = refundCurrency;
              refundResults.totalRefunded = totalRefunded;
            } else if (refundResults.currency === refundCurrency) {
              refundResults.totalRefunded += totalRefunded;
            }
            
            logger.info("UniversalRefund", `Refunded duel bets for ${player.id}`, {
              amount: totalRefunded.toString(),
              currency: refundCurrency
            });
          }
        }
      } catch (error) {
        logger.error("UniversalRefund", "Error refunding duel bets", error);
      }

      // 2. Check for dice duel bets
      try {
        const diceDuel = getActiveDuel(host.id);
        if (diceDuel && (diceDuel.challengerId === player.id || diceDuel.opponentId === player.id)) {
          // For dice duels, we need to cancel the duel for the specific player
          if (diceDuel.challengerId === player.id) {
            const result = await cancelDiceDuel(player.id);
            if (result.success) {
              refundResults.diceDuel = { 
                success: true, 
                amount: BigInt(diceDuel.amount), 
                currency: diceDuel.currency 
              };
              refundResults.anyRefunded = true;
              
              if (!refundResults.currency) {
                refundResults.currency = diceDuel.currency;
                refundResults.totalRefunded = BigInt(diceDuel.amount);
              } else if (refundResults.currency === diceDuel.currency) {
                refundResults.totalRefunded += BigInt(diceDuel.amount);
              }
              
              logger.info("UniversalRefund", `Refunded dice duel for ${player.id}`, {
                amount: diceDuel.amount,
                currency: diceDuel.currency
              });
            }
          }
        }
      } catch (error) {
        logger.error("UniversalRefund", "Error refunding dice duel", error);
      }

      // 3. Check for dice game bets
      try {
        const diceGame = getActiveDiceGame(host.id);
        if (diceGame) {
          const playerBets = diceGame.bets
            ? diceGame.bets.filter((bet) => bet.playerId === player.id)
            : [];
          
          if (playerBets.length > 0) {
            const playerWallet = await getWallet(player.id);
            let totalRefunded = 0n;
            let refundCurrency = "";

            for (const bet of playerBets) {
              const betAmount = BigInt(bet.amount);
              playerWallet[bet.currency] += betAmount;
              totalRefunded += betAmount;
              refundCurrency = bet.currency;
            }

            await updateWallet(player.id, playerWallet);

            // Remove the player's bets from the dice game
            diceGame.bets = diceGame.bets.filter(bet => bet.playerId !== player.id);

            refundResults.dice = { 
              success: true, 
              amount: totalRefunded, 
              currency: refundCurrency 
            };
            refundResults.anyRefunded = true;
            
            if (!refundResults.currency) {
              refundResults.currency = refundCurrency;
              refundResults.totalRefunded = totalRefunded;
            } else if (refundResults.currency === refundCurrency) {
              refundResults.totalRefunded += totalRefunded;
            }
            
            logger.info("UniversalRefund", `Refunded dice game bets for ${player.id}`, {
              amount: totalRefunded.toString(),
              currency: refundCurrency
            });
          }
        }
      } catch (error) {
        logger.error("UniversalRefund", "Error refunding dice game bets", error);
      }

      // 4. Check for flower game bets
      try {
        const flowerGame = getFlowerGame(host.id);
        if (flowerGame) {
          const playerBets = flowerGame.bets
            ? flowerGame.bets.filter((bet) => bet.playerId === player.id)
            : [];
          
          if (playerBets.length > 0) {
            const playerWallet = await getWallet(player.id);
            let totalRefunded = 0n;
            let refundCurrency = "";

            for (const bet of playerBets) {
              const betAmount = BigInt(bet.amount);
              playerWallet[bet.currency] += betAmount;
              totalRefunded += betAmount;
              refundCurrency = bet.currency;
            }

            await updateWallet(player.id, playerWallet);

            // Remove the player's bets from the flower game
            flowerGame.bets = flowerGame.bets.filter(bet => bet.playerId !== player.id);

            refundResults.flowerGame = { 
              success: true, 
              amount: totalRefunded, 
              currency: refundCurrency 
            };
            refundResults.anyRefunded = true;
            
            if (!refundResults.currency) {
              refundResults.currency = refundCurrency;
              refundResults.totalRefunded = totalRefunded;
            } else if (refundResults.currency === refundCurrency) {
              refundResults.totalRefunded += totalRefunded;
            }
            
            logger.info("UniversalRefund", `Refunded flower game bets for ${player.id}`, {
              amount: totalRefunded.toString(),
              currency: refundCurrency
            });
          }
        }
      } catch (error) {
        logger.error("UniversalRefund", "Error refunding flower game bets", error);
      }

      // 5. Check for hot/cold game bets
      try {
        const hotColdGame = getActiveHotColdGame(host.id);
        if (hotColdGame) {
          const playerBets = hotColdGame.bets
            ? hotColdGame.bets.filter((bet) => bet.playerId === player.id)
            : [];
          
          if (playerBets.length > 0) {
            const playerWallet = await getWallet(player.id);
            let totalRefunded = 0n;
            let refundCurrency = "";

            for (const bet of playerBets) {
              const betAmount = BigInt(bet.amount);
              playerWallet[bet.currency] += betAmount;
              totalRefunded += betAmount;
              refundCurrency = bet.currency;
            }

            await updateWallet(player.id, playerWallet);

            // Remove the player's bets from the hot/cold game
            hotColdGame.bets = hotColdGame.bets.filter(bet => bet.playerId !== player.id);

            refundResults.hotCold = { 
              success: true, 
              amount: totalRefunded, 
              currency: refundCurrency 
            };
            refundResults.anyRefunded = true;
            
            if (!refundResults.currency) {
              refundResults.currency = refundCurrency;
              refundResults.totalRefunded = totalRefunded;
            } else if (refundResults.currency === refundCurrency) {
              refundResults.totalRefunded += totalRefunded;
            }
            
            logger.info("UniversalRefund", `Refunded hot/cold game bets for ${player.id}`, {
              amount: totalRefunded.toString(),
              currency: refundCurrency
            });
          }
        }
      } catch (error) {
        logger.error("UniversalRefund", "Error refunding hot/cold game bets", error);
      }

      // Generate response message
      if (refundResults.anyRefunded) {
        let responseMessage = `${EMOJIS.win} Successfully refunded ${player.toString()}'s bets:\n`;
        
        if (refundResults.duel.success) {
          responseMessage += `- Duel: **${formatAmount(refundResults.duel.amount)} ${refundResults.duel.currency.toUpperCase()}**\n`;
        }
        
        if (refundResults.diceDuel.success) {
          responseMessage += `- Dice Duel: **${formatAmount(refundResults.diceDuel.amount)} ${refundResults.diceDuel.currency.toUpperCase()}**\n`;
        }
        
        if (refundResults.dice.success) {
          responseMessage += `- Dice: **${formatAmount(refundResults.dice.amount)} ${refundResults.dice.currency.toUpperCase()}**\n`;
        }
        
        if (refundResults.flowerGame.success) {
          responseMessage += `- Flower Game: **${formatAmount(refundResults.flowerGame.amount)} ${refundResults.flowerGame.currency.toUpperCase()}**\n`;
        }
        
        if (refundResults.hotCold.success) {
          responseMessage += `- Hot/Cold: **${formatAmount(refundResults.hotCold.amount)} ${refundResults.hotCold.currency.toUpperCase()}**\n`;
        }
        
        responseMessage += `\nTotal refunded: **${formatAmount(refundResults.totalRefunded)} ${refundResults.currency.toUpperCase()}**`;
        
        await message.reply(responseMessage);

        try {
          await player.send({
            content: `${EMOJIS.win} Your bets have been refunded by ${host.toString()}. Total refund: **${formatAmount(refundResults.totalRefunded)} ${refundResults.currency.toUpperCase()}**`,
          });
        } catch (dmError) {
          logger.warn("UniversalRefund", `Could not DM ${player.username} about their refund.`);
        }
      } else {
        return message.reply(`❌ ${player.username} does not have any active bets with you.`);
      }
    } catch (error) {
      logger.error("UniversalRefund", "Error in !refund command", error);
      await message.reply(`❌ An error occurred: ${error.message}`);
    }
  },
  
  // Command aliases
  aliases: ["refund"],
};