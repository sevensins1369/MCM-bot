// commands/resetduel.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getPlayerStats } = require("../utils/PlayerStatsManager");
const fs = require("fs");
const path = require("path");
const { logger } = require("../enhanced-logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("resetstreak")
    .setDescription("Reset your game streaks for a fresh session (Host only)")
    .addStringOption((option) =>
      option
        .setName("game_type")
        .setDescription("The type of game streak to reset")
        .setRequired(true)
        .addChoices(
          { name: "All Games", value: "all" },
          { name: "Duels", value: "duels" },
          { name: "Dice", value: "dice" },
          { name: "Dice Duels", value: "diceduels" },
          { name: "Flower Games", value: "flowers" },
          { name: "Hot/Cold", value: "hotcold" }
        )
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const user = interaction.user;
      const isHost = interaction.member.roles.cache.has(
        process.env.HOST_ROLE_ID
      );
      const isAdmin = interaction.member.permissions.has("Administrator");

      if (!isHost && !isAdmin) {
        return interaction.editReply({
          content:
            "❌ You do not have permission to use this command. Only hosts can reset game streaks.",
        });
      }

      const gameType = interaction.options.getString("game_type");
      
      logger.info("ResetStreakCommand", `Streak reset requested by ${user.tag} for ${gameType}`);

      // Get current stats
      const playerStats = await getPlayerStats(user.id);

      // Create an object to store old stats for the confirmation message
      const oldStats = {};
      const resetFields = [];

      // Reset stats based on game type
      if (gameType === "all" || gameType === "duels") {
        oldStats.duels = {
          wins: playerStats.duelsWon || 0,
          losses: playerStats.duelsLost || 0
        };
        playerStats.duelsWon = 0;
        playerStats.duelsLost = 0;
        resetFields.push("duels");
        
        // Clear duel history
        await clearDuelHistory(user.id);
      }

      if (gameType === "all" || gameType === "dice") {
        oldStats.dice = {
          wins: playerStats.diceWon || 0,
          losses: playerStats.diceLost || 0
        };
        playerStats.diceWon = 0;
        playerStats.diceLost = 0;
        resetFields.push("dice");
      }

      if (gameType === "all" || gameType === "diceduels") {
        oldStats.diceduels = {
          wins: playerStats.diceDuelsWon || 0,
          losses: playerStats.diceDuelsLost || 0
        };
        playerStats.diceDuelsWon = 0;
        playerStats.diceDuelsLost = 0;
        resetFields.push("dice duels");
      }

      if (gameType === "all" || gameType === "flowers") {
        oldStats.flowers = {
          wins: playerStats.flowersWon || 0,
          losses: playerStats.flowersLost || 0
        };
        playerStats.flowersWon = 0;
        playerStats.flowersLost = 0;
        resetFields.push("flower games");
      }

      if (gameType === "all" || gameType === "hotcold") {
        oldStats.hotcold = {
          wins: playerStats.hotColdWon || 0,
          losses: playerStats.hotColdLost || 0
        };
        playerStats.hotColdWon = 0;
        playerStats.hotColdLost = 0;
        resetFields.push("hot/cold games");
      }

      // Update the cache
      const { statsCache } = require("../utils/PlayerStatsManager");
      statsCache.set(user.id, playerStats);

      // Save to storage
      const { saveStats } = require("../utils/PlayerStatsManager");
      saveStats();

      // If using MongoDB, update there too
      if (require("../utils/database").isUsingMongoDB()) {
        try {
          const PlayerStats = require("../models/PlayerStats");
          if (PlayerStats) {
            const updateData = {
              updatedAt: new Date()
            };
            
            if (gameType === "all" || gameType === "duels") {
              updateData.duelsWon = 0;
              updateData.duelsLost = 0;
              updateData.duelHistory = [];
            }
            
            if (gameType === "all" || gameType === "dice") {
              updateData.diceWon = 0;
              updateData.diceLost = 0;
            }
            
            if (gameType === "all" || gameType === "diceduels") {
              updateData.diceDuelsWon = 0;
              updateData.diceDuelsLost = 0;
            }
            
            if (gameType === "all" || gameType === "flowers") {
              updateData.flowersWon = 0;
              updateData.flowersLost = 0;
            }
            
            if (gameType === "all" || gameType === "hotcold") {
              updateData.hotColdWon = 0;
              updateData.hotColdLost = 0;
            }
            
            await PlayerStats.updateOne(
              { userId: user.id },
              { $set: updateData },
              { upsert: true }
            );
            
            logger.info("ResetStreakCommand", `MongoDB stats updated for ${user.id}`, {
              resetFields
            });
          }
        } catch (error) {
          logger.error(
            "ResetStreakCommand",
            `Error updating stats in MongoDB for user ${user.id}: ${error.message}`,
            error
          );
        }
      }

      // Create confirmation embed
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("Game Streaks Reset")
        .setDescription(`Your ${resetFields.join(", ")} streaks have been reset for a fresh session.`)
        .setTimestamp();

      // Add fields for each reset game type
      if (oldStats.duels) {
        const totalDuels = oldStats.duels.wins + oldStats.duels.losses;
        const winRate = totalDuels > 0 ? ((oldStats.duels.wins / totalDuels) * 100).toFixed(1) : 0;
        
        embed.addFields({
          name: "Duels - Previous Stats",
          value: `Wins: ${oldStats.duels.wins}\nLosses: ${oldStats.duels.losses}\nTotal: ${totalDuels}\nWin Rate: ${winRate}%`,
          inline: true
        });
      }

      if (oldStats.dice) {
        const totalDice = oldStats.dice.wins + oldStats.dice.losses;
        const winRate = totalDice > 0 ? ((oldStats.dice.wins / totalDice) * 100).toFixed(1) : 0;
        
        embed.addFields({
          name: "Dice - Previous Stats",
          value: `Wins: ${oldStats.dice.wins}\nLosses: ${oldStats.dice.losses}\nTotal: ${totalDice}\nWin Rate: ${winRate}%`,
          inline: true
        });
      }

      if (oldStats.diceduels) {
        const totalDiceDuels = oldStats.diceduels.wins + oldStats.diceduels.losses;
        const winRate = totalDiceDuels > 0 ? ((oldStats.diceduels.wins / totalDiceDuels) * 100).toFixed(1) : 0;
        
        embed.addFields({
          name: "Dice Duels - Previous Stats",
          value: `Wins: ${oldStats.diceduels.wins}\nLosses: ${oldStats.diceduels.losses}\nTotal: ${totalDiceDuels}\nWin Rate: ${winRate}%`,
          inline: true
        });
      }

      if (oldStats.flowers) {
        const totalFlowers = oldStats.flowers.wins + oldStats.flowers.losses;
        const winRate = totalFlowers > 0 ? ((oldStats.flowers.wins / totalFlowers) * 100).toFixed(1) : 0;
        
        embed.addFields({
          name: "Flower Games - Previous Stats",
          value: `Wins: ${oldStats.flowers.wins}\nLosses: ${oldStats.flowers.losses}\nTotal: ${totalFlowers}\nWin Rate: ${winRate}%`,
          inline: true
        });
      }

      if (oldStats.hotcold) {
        const totalHotCold = oldStats.hotcold.wins + oldStats.hotcold.losses;
        const winRate = totalHotCold > 0 ? ((oldStats.hotcold.wins / totalHotCold) * 100).toFixed(1) : 0;
        
        embed.addFields({
          name: "Hot/Cold - Previous Stats",
          value: `Wins: ${oldStats.hotcold.wins}\nLosses: ${oldStats.hotcold.losses}\nTotal: ${totalHotCold}\nWin Rate: ${winRate}%`,
          inline: true
        });
      }

      await interaction.editReply({ embeds: [embed] });

      logger.info(
        "ResetStreakCommand",
        `${user.username} reset their ${gameType} streaks successfully`
      );
    } catch (error) {
      logger.error("ResetStreakCommand", `Error in command: ${error.message}`, error);
      await interaction.editReply({
        content: `❌ An error occurred: ${error.message}`,
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
          "❌ You do not have permission to use this command. Only hosts can reset game streaks."
        );
      }

      // Default to resetting all streaks if no argument is provided
      let gameType = "all";
      
      if (args.length > 0) {
        const requestedType = args[0].toLowerCase();
        if (["all", "duels", "dice", "diceduels", "flowers", "hotcold"].includes(requestedType)) {
          gameType = requestedType;
        } else {
          return message.reply(
            "❌ Invalid game type. Use one of: all, duels, dice, diceduels, flowers, hotcold"
          );
        }
      }
      
      logger.info("ResetStreakCommand", `Streak reset requested by ${user.tag} for ${gameType}`);

      // Get current stats
      const playerStats = await getPlayerStats(user.id);

      // Create an object to store old stats for the confirmation message
      const oldStats = {};
      const resetFields = [];

      // Reset stats based on game type
      if (gameType === "all" || gameType === "duels") {
        oldStats.duels = {
          wins: playerStats.duelsWon || 0,
          losses: playerStats.duelsLost || 0
        };
        playerStats.duelsWon = 0;
        playerStats.duelsLost = 0;
        resetFields.push("duels");
        
        // Clear duel history
        await clearDuelHistory(user.id);
      }

      if (gameType === "all" || gameType === "dice") {
        oldStats.dice = {
          wins: playerStats.diceWon || 0,
          losses: playerStats.diceLost || 0
        };
        playerStats.diceWon = 0;
        playerStats.diceLost = 0;
        resetFields.push("dice");
      }

      if (gameType === "all" || gameType === "diceduels") {
        oldStats.diceduels = {
          wins: playerStats.diceDuelsWon || 0,
          losses: playerStats.diceDuelsLost || 0
        };
        playerStats.diceDuelsWon = 0;
        playerStats.diceDuelsLost = 0;
        resetFields.push("dice duels");
      }

      if (gameType === "all" || gameType === "flowers") {
        oldStats.flowers = {
          wins: playerStats.flowersWon || 0,
          losses: playerStats.flowersLost || 0
        };
        playerStats.flowersWon = 0;
        playerStats.flowersLost = 0;
        resetFields.push("flower games");
      }

      if (gameType === "all" || gameType === "hotcold") {
        oldStats.hotcold = {
          wins: playerStats.hotColdWon || 0,
          losses: playerStats.hotColdLost || 0
        };
        playerStats.hotColdWon = 0;
        playerStats.hotColdLost = 0;
        resetFields.push("hot/cold games");
      }

      // Update the cache
      const { statsCache } = require("../utils/PlayerStatsManager");
      statsCache.set(user.id, playerStats);

      // Save to storage
      const { saveStats } = require("../utils/PlayerStatsManager");
      saveStats();

      // If using MongoDB, update there too
      if (require("../utils/database").isUsingMongoDB()) {
        try {
          const PlayerStats = require("../models/PlayerStats");
          if (PlayerStats) {
            const updateData = {
              updatedAt: new Date()
            };
            
            if (gameType === "all" || gameType === "duels") {
              updateData.duelsWon = 0;
              updateData.duelsLost = 0;
              updateData.duelHistory = [];
            }
            
            if (gameType === "all" || gameType === "dice") {
              updateData.diceWon = 0;
              updateData.diceLost = 0;
            }
            
            if (gameType === "all" || gameType === "diceduels") {
              updateData.diceDuelsWon = 0;
              updateData.diceDuelsLost = 0;
            }
            
            if (gameType === "all" || gameType === "flowers") {
              updateData.flowersWon = 0;
              updateData.flowersLost = 0;
            }
            
            if (gameType === "all" || gameType === "hotcold") {
              updateData.hotColdWon = 0;
              updateData.hotColdLost = 0;
            }
            
            await PlayerStats.updateOne(
              { userId: user.id },
              { $set: updateData },
              { upsert: true }
            );
            
            logger.info("ResetStreakCommand", `MongoDB stats updated for ${user.id}`, {
              resetFields
            });
          }
        } catch (error) {
          logger.error(
            "ResetStreakCommand",
            `Error updating stats in MongoDB for user ${user.id}: ${error.message}`,
            error
          );
        }
      }

      // Create confirmation embed
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle("Game Streaks Reset")
        .setDescription(`Your ${resetFields.join(", ")} streaks have been reset for a fresh session.`)
        .setTimestamp();

      // Add fields for each reset game type
      if (oldStats.duels) {
        const totalDuels = oldStats.duels.wins + oldStats.duels.losses;
        const winRate = totalDuels > 0 ? ((oldStats.duels.wins / totalDuels) * 100).toFixed(1) : 0;
        
        embed.addFields({
          name: "Duels - Previous Stats",
          value: `Wins: ${oldStats.duels.wins}\nLosses: ${oldStats.duels.losses}\nTotal: ${totalDuels}\nWin Rate: ${winRate}%`,
          inline: true
        });
      }

      if (oldStats.dice) {
        const totalDice = oldStats.dice.wins + oldStats.dice.losses;
        const winRate = totalDice > 0 ? ((oldStats.dice.wins / totalDice) * 100).toFixed(1) : 0;
        
        embed.addFields({
          name: "Dice - Previous Stats",
          value: `Wins: ${oldStats.dice.wins}\nLosses: ${oldStats.dice.losses}\nTotal: ${totalDice}\nWin Rate: ${winRate}%`,
          inline: true
        });
      }

      if (oldStats.diceduels) {
        const totalDiceDuels = oldStats.diceduels.wins + oldStats.diceduels.losses;
        const winRate = totalDiceDuels > 0 ? ((oldStats.diceduels.wins / totalDiceDuels) * 100).toFixed(1) : 0;
        
        embed.addFields({
          name: "Dice Duels - Previous Stats",
          value: `Wins: ${oldStats.diceduels.wins}\nLosses: ${oldStats.diceduels.losses}\nTotal: ${totalDiceDuels}\nWin Rate: ${winRate}%`,
          inline: true
        });
      }

      if (oldStats.flowers) {
        const totalFlowers = oldStats.flowers.wins + oldStats.flowers.losses;
        const winRate = totalFlowers > 0 ? ((oldStats.flowers.wins / totalFlowers) * 100).toFixed(1) : 0;
        
        embed.addFields({
          name: "Flower Games - Previous Stats",
          value: `Wins: ${oldStats.flowers.wins}\nLosses: ${oldStats.flowers.losses}\nTotal: ${totalFlowers}\nWin Rate: ${winRate}%`,
          inline: true
        });
      }

      if (oldStats.hotcold) {
        const totalHotCold = oldStats.hotcold.wins + oldStats.hotcold.losses;
        const winRate = totalHotCold > 0 ? ((oldStats.hotcold.wins / totalHotCold) * 100).toFixed(1) : 0;
        
        embed.addFields({
          name: "Hot/Cold - Previous Stats",
          value: `Wins: ${oldStats.hotcold.wins}\nLosses: ${oldStats.hotcold.losses}\nTotal: ${totalHotCold}\nWin Rate: ${winRate}%`,
          inline: true
        });
      }

      await message.reply({ embeds: [embed] });

      logger.info(
        "ResetStreakCommand",
        `${user.username} reset their ${gameType} streaks successfully`
      );
    } catch (error) {
      logger.error("ResetStreakCommand", `Error in prefix command: ${error.message}`, error);
      await message.reply(`❌ An error occurred: ${error.message}`);
    }
  },

  // Helper function to clear duel history
  async clearDuelHistory(userId) {
    try {
      // Clear duel history from cache
      const { duelHistoryCache } = require("../utils/PlayerStatsManager");
      if (duelHistoryCache && duelHistoryCache.has(userId)) {
        duelHistoryCache.set(userId, []);
      }

      // Also clear duel history from file
      const DUEL_HISTORY_FILE = path.join(__dirname, "/container/data/duelHistory.json"
      );
      if (fs.existsSync(DUEL_HISTORY_FILE)) {
        try {
          const data = fs.readFileSync(DUEL_HISTORY_FILE, "utf8");
          const history = JSON.parse(data);

          if (history[userId]) {
            history[userId] = []; // Clear the user's duel history
            fs.writeFileSync(
              DUEL_HISTORY_FILE,
              JSON.stringify(history, null, 2)
            );
          }
        } catch (error) {
          logger.error("ResetStreakCommand", `Error clearing duel history: ${error.message}`, error);
        }
      }
    } catch (error) {
      logger.error("ResetStreakCommand", `Error in clearDuelHistory: ${error.message}`, error);
    }
  },

  // Command aliases
  aliases: ["rs", "resetduel", "resetstreaks", "rd"],
};