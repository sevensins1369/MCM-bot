// commands/mybets.js
// Command to view your active bets

const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const { DuelManager } = require('../utils/DuelManager');
const { DiceManager } = require('../utils/DiceManager');
const { FlowerGameManager } = require('../utils/FlowerGameManager');
const { EMOJIS, formatAmount } = require('../utils/embedcreator');
const { ValidationError, safeExecute } = require('../utils/error-handler');

module.exports = {
  // Slash command definition
  data: new SlashCommandBuilder()
    .setName('mybets')
    .setDescription('View your active bets'),
  
  // Slash command execution
  async execute(interaction) {
    return await safeExecute(async () => {
      const userId = interaction.user.id;
      
      // Get active duels
      const activeDuels = await DuelManager.getActiveDuels();
      const myDuelBets = [];
      
      for (const duel of activeDuels) {
        if (duel.bets) {
          for (const bet of duel.bets) {
            if (bet.playerId === userId) {
              myDuelBets.push({
                type: 'Duel',
                hostId: duel.hostId,
                amount: bet.amount,
                currency: bet.currency,
                details: `${bet.prediction} ${duel.player1} vs ${duel.player2}`
              });
            }
          }
        }
      }
      
      // Get active dice games
      const activeDiceGames = await DiceManager.getActiveDiceGames();
      const myDiceBets = [];
      
      for (const [hostId, game] of activeDiceGames.entries()) {
        if (game.bets) {
          for (const bet of game.bets) {
            if (bet.playerId === userId) {
              myDiceBets.push({
                type: 'Dice',
                hostId,
                amount: bet.amount,
                currency: bet.currency,
                details: `${bet.prediction} ${bet.target}`
              });
            }
          }
        }
      }
      
      // Get active flower games
      const activeFlowerGames = await FlowerGameManager.getActiveFlowerGames();
      const myFlowerBets = [];
      
      for (const [hostId, game] of activeFlowerGames.entries()) {
        if (game.bets) {
          for (const bet of game.bets) {
            if (bet.playerId === userId) {
              myFlowerBets.push({
                type: 'Flower',
                hostId,
                amount: bet.amount,
                currency: bet.currency,
                details: `${bet.betType} (${game.gameType})`
              });
            }
          }
        }
      }
      
      // Combine all bets
      const allBets = [...myDuelBets, ...myDiceBets, ...myFlowerBets];
      
      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`${EMOJIS.stash} Your Active Bets`)
        .setColor(0xDAA520)
        .setDescription(`You have ${allBets.length} active bets.`)
        .setTimestamp()
        .setFooter({ text: 'My Bets' });
      
      // Add fields for each bet type
      if (myDuelBets.length > 0) {
        let duelBetsText = '';
        for (const bet of myDuelBets) {
          duelBetsText += `${formatAmount(bet.amount)} ${bet.currency.toUpperCase()} - ${bet.details}\n`;
        }
        embed.addFields({ name: `Duel Bets (${myDuelBets.length})`, value: duelBetsText });
      }
      
      if (myDiceBets.length > 0) {
        let diceBetsText = '';
        for (const bet of myDiceBets) {
          diceBetsText += `${formatAmount(bet.amount)} ${bet.currency.toUpperCase()} - ${bet.details}\n`;
        }
        embed.addFields({ name: `Dice Bets (${myDiceBets.length})`, value: diceBetsText });
      }
      
      if (myFlowerBets.length > 0) {
        let flowerBetsText = '';
        for (const bet of myFlowerBets) {
          flowerBetsText += `${formatAmount(bet.amount)} ${bet.currency.toUpperCase()} - ${bet.details}\n`;
        }
        embed.addFields({ name: `Flower Bets (${myFlowerBets.length})`, value: flowerBetsText });
      }
      
      // If no bets, add a field saying so
      if (allBets.length === 0) {
        embed.setDescription('You have no active bets.');
      }
      
      // Send embed
      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }, interaction);
  },
  
  // Prefix command execution
  async run(message, args) {
    return await safeExecute(async () => {
      const userId = message.author.id;
      
      // Get active duels
      const activeDuels = await DuelManager.getActiveDuels();
      const myDuelBets = [];
      
      for (const duel of activeDuels) {
        if (duel.bets) {
          for (const bet of duel.bets) {
            if (bet.playerId === userId) {
              myDuelBets.push({
                type: 'Duel',
                hostId: duel.hostId,
                amount: bet.amount,
                currency: bet.currency,
                details: `${bet.prediction} ${duel.player1} vs ${duel.player2}`
              });
            }
          }
        }
      }
      
      // Get active dice games
      const activeDiceGames = await DiceManager.getActiveDiceGames();
      const myDiceBets = [];
      
      for (const [hostId, game] of activeDiceGames.entries()) {
        if (game.bets) {
          for (const bet of game.bets) {
            if (bet.playerId === userId) {
              myDiceBets.push({
                type: 'Dice',
                hostId,
                amount: bet.amount,
                currency: bet.currency,
                details: `${bet.prediction} ${bet.target}`
              });
            }
          }
        }
      }
      
      // Get active flower games
      const activeFlowerGames = await FlowerGameManager.getActiveFlowerGames();
      const myFlowerBets = [];
      
      for (const [hostId, game] of activeFlowerGames.entries()) {
        if (game.bets) {
          for (const bet of game.bets) {
            if (bet.playerId === userId) {
              myFlowerBets.push({
                type: 'Flower',
                hostId,
                amount: bet.amount,
                currency: bet.currency,
                details: `${bet.betType} (${game.gameType})`
              });
            }
          }
        }
      }
      
      // Combine all bets
      const allBets = [...myDuelBets, ...myDiceBets, ...myFlowerBets];
      
      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`${EMOJIS.stash} Your Active Bets`)
        .setColor(0xDAA520)
        .setDescription(`You have ${allBets.length} active bets.`)
        .setTimestamp()
        .setFooter({ text: 'My Bets' });
      
      // Add fields for each bet type
      if (myDuelBets.length > 0) {
        let duelBetsText = '';
        for (const bet of myDuelBets) {
          duelBetsText += `${formatAmount(bet.amount)} ${bet.currency.toUpperCase()} - ${bet.details}\n`;
        }
        embed.addFields({ name: `Duel Bets (${myDuelBets.length})`, value: duelBetsText });
      }
      
      if (myDiceBets.length > 0) {
        let diceBetsText = '';
        for (const bet of myDiceBets) {
          diceBetsText += `${formatAmount(bet.amount)} ${bet.currency.toUpperCase()} - ${bet.details}\n`;
        }
        embed.addFields({ name: `Dice Bets (${myDiceBets.length})`, value: diceBetsText });
      }
      
      if (myFlowerBets.length > 0) {
        let flowerBetsText = '';
        for (const bet of myFlowerBets) {
          flowerBetsText += `${formatAmount(bet.amount)} ${bet.currency.toUpperCase()} - ${bet.details}\n`;
        }
        embed.addFields({ name: `Flower Bets (${myFlowerBets.length})`, value: flowerBetsText });
      }
      
      // If no bets, add a field saying so
      if (allBets.length === 0) {
        embed.setDescription('You have no active bets.');
      }
      
      // Send embed
      await message.reply({
        embeds: [embed]
      });
    }, message);
  },
  
  // Command aliases
  aliases: ['mb']
};