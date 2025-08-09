// commands/jackpot-info.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getJackpot, getActiveJackpots, getUserWinChance, getUserTickets } = require('../utils/JackpotManager');
const { formatAmount, EMOJIS } = require('../utils/embedcreator');
const { logger } = require('../enhanced-logger');
const { withErrorHandling, ValidationError } = require('../error-handler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('jackpot-info')
    .setDescription('View information about a jackpot game')
    .addStringOption(option => 
      option
        .setName('game_id')
        .setDescription('The ID of the jackpot game (optional, shows all active jackpots if omitted)')
        .setRequired(false)
    ),

  execute: withErrorHandling(async function(interaction) {
    await interaction.deferReply();
    
    // Get options
    const gameIdInput = interaction.options.getString('game_id');
    
    // If game ID is provided, show specific jackpot info
    if (gameIdInput) {
      // Find jackpot by partial ID
      const activeJackpots = getActiveJackpots();
      const jackpot = activeJackpots.find(j => j.gameId.startsWith(gameIdInput));
      
      if (!jackpot) {
        throw new ValidationError('Jackpot game not found. Please check the ID and try again.');
      }
      
      // Calculate user's win chance and tickets if they have entered
      const winChance = getUserWinChance(jackpot.gameId, interaction.user.id);
      const userTickets = getUserTickets(jackpot.gameId, interaction.user.id);
      
      // Get top entries (by tickets)
      const topEntries = [...jackpot.entries]
        .sort((a, b) => b.tickets - a.tickets)
        .slice(0, 5);
      
      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`${EMOJIS.JACKPOT} Jackpot #${jackpot.gameId.substring(0, 8)} ${EMOJIS.JACKPOT}`)
        .setDescription(`Current jackpot information`)
        .addFields(
          { name: 'Currency', value: jackpot.currency.toUpperCase(), inline: true },
          { name: 'Minimum Entry', value: formatAmount(jackpot.minEntryAmount), inline: true },
          { name: 'Drawing In', value: `<t:${Math.floor(new Date(jackpot.drawTime).getTime() / 1000)}:R>`, inline: true },
          { name: 'Total Pot', value: `${formatAmount(jackpot.totalPot)} ${jackpot.currency.toUpperCase()}`, inline: true },
          { name: 'Total Entries', value: jackpot.entries.length.toString(), inline: true },
          { name: 'Created By', value: `<@${jackpot.createdBy}>`, inline: true }
        )
        .setColor('#FFD700') // Gold color
        .setTimestamp()
        .setFooter({ text: `Game ID: ${jackpot.gameId}` });
      
      // Add user's stats if they have entered
      if (userTickets > 0) {
        embed.addFields(
          { name: 'Your Tickets', value: userTickets.toString(), inline: true },
          { name: 'Your Win Chance', value: `${winChance.toFixed(2)}%`, inline: true },
          { name: '\u200B', value: '\u200B', inline: true } // Empty field for alignment
        );
      }
      
      // Add top entries
      if (topEntries.length > 0) {
        let topEntriesText = '';
        for (let i = 0; i < topEntries.length; i++) {
          const entry = topEntries[i];
          const entryWinChance = (entry.tickets / jackpot.entries.reduce((sum, e) => sum + e.tickets, 0)) * 100;
          topEntriesText += `${i + 1}. <@${entry.userId}>: ${entry.tickets} tickets (${entryWinChance.toFixed(2)}%)\n`;
        }
        embed.addFields({ name: 'Top Entries', value: topEntriesText });
      }
      
      // Send embed
      await interaction.editReply({ embeds: [embed] });
      
      logger.info('JackpotInfo', `User ${interaction.user.id} viewed jackpot ${jackpot.gameId} info`);
    } else {
      // Show all active jackpots
      const activeJackpots = getActiveJackpots();
      
      if (activeJackpots.length === 0) {
        return interaction.editReply('No active jackpots found. Create one with `/create-jackpot`!');
      }
      
      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`${EMOJIS.JACKPOT} Active Jackpots ${EMOJIS.JACKPOT}`)
        .setDescription(`There are currently ${activeJackpots.length} active jackpots.`)
        .setColor('#FFD700') // Gold color
        .setTimestamp();
      
      // Add fields for each jackpot
      for (const jackpot of activeJackpots) {
        const userTickets = getUserTickets(jackpot.gameId, interaction.user.id);
        const winChance = getUserWinChance(jackpot.gameId, interaction.user.id);
        
        let fieldValue = `Currency: ${jackpot.currency.toUpperCase()}\n` +
                         `Total Pot: ${formatAmount(jackpot.totalPot)} ${jackpot.currency.toUpperCase()}\n` +
                         `Entries: ${jackpot.entries.length}\n` +
                         `Drawing: <t:${Math.floor(new Date(jackpot.drawTime).getTime() / 1000)}:R>\n`;
        
        if (userTickets > 0) {
          fieldValue += `Your Tickets: ${userTickets} (${winChance.toFixed(2)}%)\n`;
        }
        
        fieldValue += `\nUse \`/enter-jackpot ${jackpot.gameId.substring(0, 8)} [amount]\` to enter!`;
        
        embed.addFields({
          name: `Jackpot #${jackpot.gameId.substring(0, 8)}`,
          value: fieldValue
        });
      }
      
      // Send embed
      await interaction.editReply({ embeds: [embed] });
      
      logger.info('JackpotInfo', `User ${interaction.user.id} viewed all active jackpots`);
    }
  }, 'JackpotInfo'),
  
  // For prefix command usage
  async run(message, args) {
    try {
      // Get game ID if provided
      const gameIdInput = args[0];
      
      // If game ID is provided, show specific jackpot info
      if (gameIdInput) {
        // Find jackpot by partial ID
        const activeJackpots = getActiveJackpots();
        const jackpot = activeJackpots.find(j => j.gameId.startsWith(gameIdInput));
        
        if (!jackpot) {
          return message.reply('❌ Jackpot game not found. Please check the ID and try again.');
        }
        
        // Calculate user's win chance and tickets if they have entered
        const winChance = getUserWinChance(jackpot.gameId, message.author.id);
        const userTickets = getUserTickets(jackpot.gameId, message.author.id);
        
        // Get top entries (by tickets)
        const topEntries = [...jackpot.entries]
          .sort((a, b) => b.tickets - a.tickets)
          .slice(0, 5);
        
        // Create embed
        const embed = new EmbedBuilder()
          .setTitle(`${EMOJIS.JACKPOT} Jackpot #${jackpot.gameId.substring(0, 8)} ${EMOJIS.JACKPOT}`)
          .setDescription(`Current jackpot information`)
          .addFields(
            { name: 'Currency', value: jackpot.currency.toUpperCase(), inline: true },
            { name: 'Minimum Entry', value: formatAmount(jackpot.minEntryAmount), inline: true },
            { name: 'Drawing In', value: `<t:${Math.floor(new Date(jackpot.drawTime).getTime() / 1000)}:R>`, inline: true },
            { name: 'Total Pot', value: `${formatAmount(jackpot.totalPot)} ${jackpot.currency.toUpperCase()}`, inline: true },
            { name: 'Total Entries', value: jackpot.entries.length.toString(), inline: true },
            { name: 'Created By', value: `<@${jackpot.createdBy}>`, inline: true }
          )
          .setColor('#FFD700') // Gold color
          .setTimestamp()
          .setFooter({ text: `Game ID: ${jackpot.gameId}` });
        
        // Add user's stats if they have entered
        if (userTickets > 0) {
          embed.addFields(
            { name: 'Your Tickets', value: userTickets.toString(), inline: true },
            { name: 'Your Win Chance', value: `${winChance.toFixed(2)}%`, inline: true },
            { name: '\u200B', value: '\u200B', inline: true } // Empty field for alignment
          );
        }
        
        // Add top entries
        if (topEntries.length > 0) {
          let topEntriesText = '';
          for (let i = 0; i < topEntries.length; i++) {
            const entry = topEntries[i];
            const entryWinChance = (entry.tickets / jackpot.entries.reduce((sum, e) => sum + e.tickets, 0)) * 100;
            topEntriesText += `${i + 1}. <@${entry.userId}>: ${entry.tickets} tickets (${entryWinChance.toFixed(2)}%)\n`;
          }
          embed.addFields({ name: 'Top Entries', value: topEntriesText });
        }
        
        // Send embed
        await message.reply({ embeds: [embed] });
        
        logger.info('JackpotInfo', `User ${message.author.id} viewed jackpot ${jackpot.gameId} info`);
      } else {
        // Show all active jackpots
        const activeJackpots = getActiveJackpots();
        
        if (activeJackpots.length === 0) {
          return message.reply('No active jackpots found. Create one with `!create-jackpot`!');
        }
        
        // Create embed
        const embed = new EmbedBuilder()
          .setTitle(`${EMOJIS.JACKPOT} Active Jackpots ${EMOJIS.JACKPOT}`)
          .setDescription(`There are currently ${activeJackpots.length} active jackpots.`)
          .setColor('#FFD700') // Gold color
          .setTimestamp();
        
        // Add fields for each jackpot
        for (const jackpot of activeJackpots) {
          const userTickets = getUserTickets(jackpot.gameId, message.author.id);
          const winChance = getUserWinChance(jackpot.gameId, message.author.id);
          
          let fieldValue = `Currency: ${jackpot.currency.toUpperCase()}\n` +
                           `Total Pot: ${formatAmount(jackpot.totalPot)} ${jackpot.currency.toUpperCase()}\n` +
                           `Entries: ${jackpot.entries.length}\n` +
                           `Drawing: <t:${Math.floor(new Date(jackpot.drawTime).getTime() / 1000)}:R>\n`;
          
          if (userTickets > 0) {
            fieldValue += `Your Tickets: ${userTickets} (${winChance.toFixed(2)}%)\n`;
          }
          
          fieldValue += `\nUse \`!enter-jackpot ${jackpot.gameId.substring(0, 8)} [amount]\` to enter!`;
          
          embed.addFields({
            name: `Jackpot #${jackpot.gameId.substring(0, 8)}`,
            value: fieldValue
          });
        }
        
        // Send embed
        await message.reply({ embeds: [embed] });
        
        logger.info('JackpotInfo', `User ${message.author.id} viewed all active jackpots`);
      }
    } catch (error) {
      logger.error('JackpotInfo', 'Error in prefix command', error);
      message.reply(`❌ Error: ${error.message}`);
    }
  },
  
  // Command aliases
  aliases: ['jackpotinfo', 'jp', 'jackpot', 'jackpots']
};