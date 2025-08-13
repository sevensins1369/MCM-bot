// commands/mybets.js
// Command to view your active bets

const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const { EMOJIS, formatAmount } = require('../utils/embedcreator');
const { logger } = require('../enhanced-logger');

// Import all game managers
const { getDuel } = require('../utils/DuelManager');
const { getActiveDiceGames } = require('../utils/DiceManager');
const { getActiveFlowerGames } = require('../utils/FlowerGameManager');
const { getActiveDuels } = require('../utils/DiceDuelManager');
const { getActiveHotColdGames } = require('../utils/HotColdManager');

module.exports = {
  // Slash command definition
  data: new SlashCommandBuilder()
    .setName('mybets')
    .setDescription('View your active bets across all game modes'),
  
  // Slash command execution
  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const userId = interaction.user.id;
      
      logger.info("MyBetsCommand", `Fetching bets for user ${interaction.user.tag}`);
      
      // Get all active bets across different game modes
      const allBets = await getAllActiveBets(userId);
      
      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`${EMOJIS.stash} Your Active Bets`)
        .setColor(0xDAA520)
        .setDescription(`You have ${allBets.length} active bets.`)
        .setTimestamp()
        .setFooter({ text: 'My Bets' });
      
      // Group bets by game type
      const betsByType = groupBetsByType(allBets);
      
      // Add fields for each bet type
      for (const [gameType, bets] of Object.entries(betsByType)) {
        if (bets.length > 0) {
          let betsText = '';
          for (const bet of bets) {
            betsText += `${formatAmount(bet.amount)} ${bet.currency.toUpperCase()} - ${bet.details}\n`;
          }
          embed.addFields({ name: `${gameType} Bets (${bets.length})`, value: betsText });
        }
      }
      
      // If no bets, update description
      if (allBets.length === 0) {
        embed.setDescription('You have no active bets.');
      }
      
      // Send embed
      await interaction.editReply({
        embeds: [embed],
        ephemeral: true
      });
      
      logger.info("MyBetsCommand", `Displayed ${allBets.length} bets for user ${interaction.user.tag}`);
    } catch (error) {
      logger.error("MyBetsCommand", `Error in /mybets command: ${error.message}`, error);
      await interaction.editReply({
        content: `❌ An error occurred while fetching your bets: ${error.message}`,
        ephemeral: true
      });
    }
  },
  
  // Prefix command execution
  async run(message, args) {
    try {
      const userId = message.author.id;
      
      logger.info("MyBetsCommand", `Fetching bets for user ${message.author.tag} (prefix command)`);
      
      // Get all active bets across different game modes
      const allBets = await getAllActiveBets(userId);
      
      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`${EMOJIS.stash} Your Active Bets`)
        .setColor(0xDAA520)
        .setDescription(`You have ${allBets.length} active bets.`)
        .setTimestamp()
        .setFooter({ text: 'My Bets' });
      
      // Group bets by game type
      const betsByType = groupBetsByType(allBets);
      
      // Add fields for each bet type
      for (const [gameType, bets] of Object.entries(betsByType)) {
        if (bets.length > 0) {
          let betsText = '';
          for (const bet of bets) {
            betsText += `${formatAmount(bet.amount)} ${bet.currency.toUpperCase()} - ${bet.details}\n`;
          }
          embed.addFields({ name: `${gameType} Bets (${bets.length})`, value: betsText });
        }
      }
      
      // If no bets, update description
      if (allBets.length === 0) {
        embed.setDescription('You have no active bets.');
      }
      
      // Send embed
      await message.reply({
        embeds: [embed]
      });
      
      logger.info("MyBetsCommand", `Displayed ${allBets.length} bets for user ${message.author.tag} (prefix command)`);
    } catch (error) {
      logger.error("MyBetsCommand", `Error in !mybets command: ${error.message}`, error);
      await message.reply(`❌ An error occurred while fetching your bets: ${error.message}`);
    }
  },
  
  // Command aliases
  aliases: ['mb']
};

/**
 * Fetches all active bets for a user across all game modes
 * @param {string} userId - The user ID to fetch bets for
 * @returns {Promise<Array>} - Array of bet objects
 */
async function getAllActiveBets(userId) {
  try {
    const allBets = [];
    
    // 1. Get duel bets
    try {
      const activeDuels = await getActiveDuels();
      for (const duel of activeDuels) {
        if (duel.bets) {
          for (const bet of duel.bets) {
            if (bet.playerId === userId) {
              allBets.push({
                type: 'Duel',
                hostId: duel.hostId,
                amount: BigInt(bet.amount),
                currency: bet.currency,
                details: `${bet.prediction} ${duel.player1} vs ${duel.player2}`,
                gameType: 'Duel'
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error("MyBetsCommand", `Error fetching duel bets: ${error.message}`, error);
    }
    
    // 2. Get dice game bets
    try {
      const activeDiceGames = await getActiveDiceGames();
      for (const [hostId, game] of Object.entries(activeDiceGames)) {
        if (game.bets) {
          for (const bet of game.bets) {
            if (bet.playerId === userId) {
              allBets.push({
                type: 'Dice',
                hostId,
                amount: BigInt(bet.amount),
                currency: bet.currency,
                details: `${bet.prediction} ${bet.target || ''}`,
                gameType: 'Dice'
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error("MyBetsCommand", `Error fetching dice game bets: ${error.message}`, error);
    }
    
    // 3. Get dice duel bets
    try {
      const activeDiceDuels = await getActiveDuels();
      for (const duel of activeDiceDuels) {
        if (duel.challengerId === userId || duel.opponentId === userId) {
          allBets.push({
            type: 'Dice Duel',
            hostId: duel.hostId,
            amount: BigInt(duel.amount),
            currency: duel.currency,
            details: `Dice Duel with ${duel.challengerId === userId ? 'host' : 'challenger'}`,
            gameType: 'Dice Duel'
          });
        }
      }
    } catch (error) {
      logger.error("MyBetsCommand", `Error fetching dice duel bets: ${error.message}`, error);
    }
    
    // 4. Get flower game bets
    try {
      const activeFlowerGames = await getActiveFlowerGames();
      for (const [hostId, game] of Object.entries(activeFlowerGames)) {
        if (game.bets) {
          for (const bet of game.bets) {
            if (bet.playerId === userId) {
              allBets.push({
                type: 'Flower',
                hostId,
                amount: BigInt(bet.amount),
                currency: bet.currency,
                details: `${bet.betType} (${game.gameType || 'Flower Game'})`,
                gameType: 'Flower'
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error("MyBetsCommand", `Error fetching flower game bets: ${error.message}`, error);
    }
    
    // 5. Get hot/cold game bets
    try {
      const activeHotColdGames = await getActiveHotColdGames();
      for (const [hostId, game] of Object.entries(activeHotColdGames)) {
        if (game.bets) {
          for (const bet of game.bets) {
            if (bet.playerId === userId) {
              allBets.push({
                type: 'Hot/Cold',
                hostId,
                amount: BigInt(bet.amount),
                currency: bet.currency,
                details: `${bet.betType} (Hot/Cold)`,
                gameType: 'Hot/Cold'
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error("MyBetsCommand", `Error fetching hot/cold game bets: ${error.message}`, error);
    }
    
    return allBets;
  } catch (error) {
    logger.error("MyBetsCommand", `Error in getAllActiveBets: ${error.message}`, error);
    throw error;
  }
}

/**
 * Groups bets by their game type
 * @param {Array} bets - Array of bet objects
 * @returns {Object} - Object with game types as keys and arrays of bets as values
 */
function groupBetsByType(bets) {
  const grouped = {
    'Duel': [],
    'Dice': [],
    'Dice Duel': [],
    'Flower': [],
    'Hot/Cold': []
  };
  
  for (const bet of bets) {
    if (grouped[bet.type]) {
      grouped[bet.type].push(bet);
    } else {
      grouped[bet.type] = [bet];
    }
  }
  
  return grouped;
}