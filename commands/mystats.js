// commands/mystats.js
const { SlashCommandBuilder } = require('discord.js');
const { getPlayerStats } = require('../utils/PlayerStatsManager');
const { formatAmount } = require('../utils/embedcreator');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mystats')
    .setDescription('View your gambling stats'),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      
      const userId = interaction.user.id;
      const stats = await getPlayerStats(userId);
      
      // Calculate win rates
      const totalGames = stats.gamesWon + stats.gamesLost;
      const gameWinRate = totalGames > 0 ? (stats.gamesWon / totalGames * 100).toFixed(2) : 0;
      
      const totalBets = stats.betsWon + stats.betsLost;
      const betWinRate = totalBets > 0 ? (stats.betsWon / totalBets * 100).toFixed(2) : 0;
      
      // Format amounts
      const osrsWagered = formatAmount(stats.osrsWagered || '0');
      const osrsWon = formatAmount(stats.osrsWon || '0');
      const osrsLost = formatAmount(stats.osrsLost || '0');
      const rs3Wagered = formatAmount(stats.rs3Wagered || '0');
      const rs3Won = formatAmount(stats.rs3Won || '0');
      const rs3Lost = formatAmount(stats.rs3Lost || '0');
      
      // Calculate profit/loss
      const osrsProfit = BigInt(stats.osrsWon || '0') - BigInt(stats.osrsLost || '0');
      const rs3Profit = BigInt(stats.rs3Won || '0') - BigInt(stats.rs3Lost || '0');
      
      const osrsProfitFormatted = (osrsProfit >= 0 ? '+' : '') + formatAmount(osrsProfit);
      const rs3ProfitFormatted = (rs3Profit >= 0 ? '+' : '') + formatAmount(rs3Profit);
      
      // Create embed
      const embed = {
        color: 0x3498db,
        title: `${interaction.user.username}'s Gambling Stats`,
        thumbnail: {
          url: interaction.user.displayAvatarURL({ dynamic: true })
        },
        fields: [
          {
            name: '🎲 Games',
            value: `Played: ${totalGames}\nWon: ${stats.gamesWon}\nLost: ${stats.gamesLost}\nWin Rate: ${gameWinRate}%`,
            inline: true
          },
          {
            name: '💰 Bets',
            value: `Placed: ${totalBets}\nWon: ${stats.betsWon}\nLost: ${stats.betsLost}\nWin Rate: ${betWinRate}%`,
            inline: true
          },
          {
            name: '\u200B',
            value: '\u200B',
            inline: true
          },
          {
            name: '💰 OSRS',
            value: `Wagered: ${osrsWagered}\nWon: ${osrsWon}\nLost: ${osrsLost}\nProfit: ${osrsProfitFormatted}`,
            inline: true
          },
          {
            name: '💰 RS3',
            value: `Wagered: ${rs3Wagered}\nWon: ${rs3Won}\nLost: ${rs3Lost}\nProfit: ${rs3ProfitFormatted}`,
            inline: true
          }
        ],
        footer: {
          text: 'Last played: ' + (stats.lastPlayed ? new Date(stats.lastPlayed).toLocaleString() : 'Never')
        },
        timestamp: new Date()
      };
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in mystats command:', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: '❌ An error occurred while retrieving your stats.' });
      } else {
        await interaction.reply({ content: '❌ An error occurred while retrieving your stats.', ephemeral: true });
      }
    }
  },
  
  // For prefix command usage
  async run(message, args) {
    try {
      const userId = message.author.id;
      const stats = await getPlayerStats(userId);
      
      // Calculate win rates
      const totalGames = stats.gamesWon + stats.gamesLost;
      const gameWinRate = totalGames > 0 ? (stats.gamesWon / totalGames * 100).toFixed(2) : 0;
      
      const totalBets = stats.betsWon + stats.betsLost;
      const betWinRate = totalBets > 0 ? (stats.betsWon / totalBets * 100).toFixed(2) : 0;
      
      // Format amounts
      const osrsWagered = formatAmount(stats.osrsWagered || '0');
      const osrsWon = formatAmount(stats.osrsWon || '0');
      const osrsLost = formatAmount(stats.osrsLost || '0');
      const rs3Wagered = formatAmount(stats.rs3Wagered || '0');
      const rs3Won = formatAmount(stats.rs3Won || '0');
      const rs3Lost = formatAmount(stats.rs3Lost || '0');
      
      // Calculate profit/loss
      const osrsProfit = BigInt(stats.osrsWon || '0') - BigInt(stats.osrsLost || '0');
      const rs3Profit = BigInt(stats.rs3Won || '0') - BigInt(stats.rs3Lost || '0');
      
      const osrsProfitFormatted = (osrsProfit >= 0 ? '+' : '') + formatAmount(osrsProfit);
      const rs3ProfitFormatted = (rs3Profit >= 0 ? '+' : '') + formatAmount(rs3Profit);
      
      // Create embed
      const embed = {
        color: 0x3498db,
        title: `${message.author.username}'s Gambling Stats`,
        thumbnail: {
          url: message.author.displayAvatarURL({ dynamic: true })
        },
        fields: [
          {
            name: '🎲 Games',
            value: `Played: ${totalGames}\nWon: ${stats.gamesWon}\nLost: ${stats.gamesLost}\nWin Rate: ${gameWinRate}%`,
            inline: true
          },
          {
            name: '💰 Bets',
            value: `Placed: ${totalBets}\nWon: ${stats.betsWon}\nLost: ${stats.betsLost}\nWin Rate: ${betWinRate}%`,
            inline: true
          },
          {
            name: '\u200B',
            value: '\u200B',
            inline: true
          },
          {
            name: '💰 OSRS',
            value: `Wagered: ${osrsWagered}\nWon: ${osrsWon}\nLost: ${osrsLost}\nProfit: ${osrsProfitFormatted}`,
            inline: true
          },
          {
            name: '💰 RS3',
            value: `Wagered: ${rs3Wagered}\nWon: ${rs3Won}\nLost: ${rs3Lost}\nProfit: ${rs3ProfitFormatted}`,
            inline: true
          }
        ],
        footer: {
          text: 'Last played: ' + (stats.lastPlayed ? new Date(stats.lastPlayed).toLocaleString() : 'Never')
        },
        timestamp: new Date()
      };
      
      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in mystats command:', error);
      await message.reply('❌ An error occurred while retrieving your stats.');
    }
  }
};