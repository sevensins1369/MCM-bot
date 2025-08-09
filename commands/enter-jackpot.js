// commands/enter-jackpot.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { enterJackpot, getJackpot, getUserWinChance, getUserTickets } = require('../utils/JackpotManager');
const { formatAmount, EMOJIS } = require('../utils/embedcreator');
const { logger } = require('../enhanced-logger');
const { withErrorHandling, ValidationError } = require('../error-handler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('enter-jackpot')
    .setDescription('Enter a jackpot game')
    .addStringOption(option => 
      option
        .setName('game_id')
        .setDescription('The ID of the jackpot game')
        .setRequired(true)
    )
    .addStringOption(option => 
      option
        .setName('amount')
        .setDescription('Amount to enter with')
        .setRequired(true)
    ),

  execute: withErrorHandling(async function(interaction) {
    await interaction.deferReply();
    
    // Get options
    const gameIdInput = interaction.options.getString('game_id');
    const amountInput = interaction.options.getString('amount');
    
    // Find jackpot by partial ID
    const activeJackpots = require('../utils/JackpotManager').getActiveJackpots();
    const jackpot = activeJackpots.find(j => j.gameId.startsWith(gameIdInput));
    
    if (!jackpot) {
      throw new ValidationError('Jackpot game not found. Please check the ID and try again.');
    }
    
    // Parse amount
    let amount;
    try {
      // Remove commas and convert to string
      amount = amountInput.replace(/,/g, '');
      // Validate that it's a valid number
      BigInt(amount);
    } catch (error) {
      throw new ValidationError('Invalid amount. Please enter a valid number.');
    }
    
    // Enter jackpot
    const updatedJackpot = await enterJackpot(
      jackpot.gameId,
      interaction.user.id,
      interaction.user.username,
      amount
    );
    
    // Calculate user's win chance
    const winChance = getUserWinChance(jackpot.gameId, interaction.user.id);
    const userTickets = getUserTickets(jackpot.gameId, interaction.user.id);
    
    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS.JACKPOT} Jackpot Entry Confirmed ${EMOJIS.JACKPOT}`)
      .setDescription(`You have successfully entered the jackpot!`)
      .addFields(
        { name: 'Game ID', value: `${jackpot.gameId.substring(0, 8)}...`, inline: true },
        { name: 'Currency', value: jackpot.currency.toUpperCase(), inline: true },
        { name: 'Your Entry', value: formatAmount(amount), inline: true },
        { name: 'Your Tickets', value: userTickets.toString(), inline: true },
        { name: 'Win Chance', value: `${winChance.toFixed(2)}%`, inline: true },
        { name: 'Drawing In', value: `<t:${Math.floor(new Date(jackpot.drawTime).getTime() / 1000)}:R>`, inline: true },
        { name: 'Total Pot', value: `${formatAmount(updatedJackpot.totalPot)} ${jackpot.currency.toUpperCase()}`, inline: false }
      )
      .setColor('#FFD700') // Gold color
      .setTimestamp()
      .setFooter({ text: `Total Entries: ${updatedJackpot.entries.length}` });
    
    // Send embed
    await interaction.editReply({ embeds: [embed] });
    
    // Update the original jackpot message if possible
    try {
      if (jackpot.messageId && jackpot.channelId) {
        const channel = await interaction.client.channels.fetch(jackpot.channelId);
        if (channel) {
          const message = await channel.messages.fetch(jackpot.messageId);
          if (message) {
            const originalEmbed = message.embeds[0];
            const updatedEmbed = EmbedBuilder.from(originalEmbed)
              .setFields(
                { name: 'Currency', value: jackpot.currency.toUpperCase(), inline: true },
                { name: 'Minimum Entry', value: formatAmount(jackpot.minEntryAmount), inline: true },
                { name: 'Drawing In', value: `<t:${Math.floor(new Date(jackpot.drawTime).getTime() / 1000)}:R>`, inline: true },
                { name: 'Total Pot', value: `${formatAmount(updatedJackpot.totalPot)} ${jackpot.currency.toUpperCase()}`, inline: true },
                { name: 'Entries', value: updatedJackpot.entries.length.toString(), inline: true },
                { name: 'Created By', value: `<@${jackpot.createdBy}>`, inline: true },
                { name: '\u200B', value: `Use \`/enter-jackpot ${jackpot.gameId.substring(0, 8)} [amount]\` to enter!` }
              );
            
            await message.edit({ embeds: [updatedEmbed] });
          }
        }
      }
    } catch (error) {
      logger.error('EnterJackpot', 'Failed to update jackpot message', error);
      // Don't throw error here, just log it
    }
    
    logger.info('EnterJackpot', `User ${interaction.user.id} entered jackpot ${jackpot.gameId}`, {
      amount,
      totalPot: updatedJackpot.totalPot,
      winChance
    });
  }, 'EnterJackpot'),
  
  // For prefix command usage
  async run(message, args) {
    try {
      if (args.length < 2) {
        return message.reply('❌ Usage: `!enter-jackpot <game_id> <amount>`');
      }
      
      // Parse arguments
      const gameIdInput = args[0];
      const amountInput = args[1];
      
      // Find jackpot by partial ID
      const activeJackpots = require('../utils/JackpotManager').getActiveJackpots();
      const jackpot = activeJackpots.find(j => j.gameId.startsWith(gameIdInput));
      
      if (!jackpot) {
        return message.reply('❌ Jackpot game not found. Please check the ID and try again.');
      }
      
      // Parse amount
      let amount;
      try {
        // Remove commas and convert to string
        amount = amountInput.replace(/,/g, '');
        // Validate that it's a valid number
        BigInt(amount);
      } catch (error) {
        return message.reply('❌ Invalid amount. Please enter a valid number.');
      }
      
      // Enter jackpot
      const updatedJackpot = await enterJackpot(
        jackpot.gameId,
        message.author.id,
        message.author.username,
        amount
      );
      
      // Calculate user's win chance
      const winChance = getUserWinChance(jackpot.gameId, message.author.id);
      const userTickets = getUserTickets(jackpot.gameId, message.author.id);
      
      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`${EMOJIS.JACKPOT} Jackpot Entry Confirmed ${EMOJIS.JACKPOT}`)
        .setDescription(`You have successfully entered the jackpot!`)
        .addFields(
          { name: 'Game ID', value: `${jackpot.gameId.substring(0, 8)}...`, inline: true },
          { name: 'Currency', value: jackpot.currency.toUpperCase(), inline: true },
          { name: 'Your Entry', value: formatAmount(amount), inline: true },
          { name: 'Your Tickets', value: userTickets.toString(), inline: true },
          { name: 'Win Chance', value: `${winChance.toFixed(2)}%`, inline: true },
          { name: 'Drawing In', value: `<t:${Math.floor(new Date(jackpot.drawTime).getTime() / 1000)}:R>`, inline: true },
          { name: 'Total Pot', value: `${formatAmount(updatedJackpot.totalPot)} ${jackpot.currency.toUpperCase()}`, inline: false }
        )
        .setColor('#FFD700') // Gold color
        .setTimestamp()
        .setFooter({ text: `Total Entries: ${updatedJackpot.entries.length}` });
      
      // Send embed
      await message.reply({ embeds: [embed] });
      
      // Update the original jackpot message if possible
      try {
        if (jackpot.messageId && jackpot.channelId) {
          const channel = await message.client.channels.fetch(jackpot.channelId);
          if (channel) {
            const jackpotMessage = await channel.messages.fetch(jackpot.messageId);
            if (jackpotMessage) {
              const originalEmbed = jackpotMessage.embeds[0];
              const updatedEmbed = EmbedBuilder.from(originalEmbed)
                .setFields(
                  { name: 'Currency', value: jackpot.currency.toUpperCase(), inline: true },
                  { name: 'Minimum Entry', value: formatAmount(jackpot.minEntryAmount), inline: true },
                  { name: 'Drawing In', value: `<t:${Math.floor(new Date(jackpot.drawTime).getTime() / 1000)}:R>`, inline: true },
                  { name: 'Total Pot', value: `${formatAmount(updatedJackpot.totalPot)} ${jackpot.currency.toUpperCase()}`, inline: true },
                  { name: 'Entries', value: updatedJackpot.entries.length.toString(), inline: true },
                  { name: 'Created By', value: `<@${jackpot.createdBy}>`, inline: true },
                  { name: '\u200B', value: `Use \`!enter-jackpot ${jackpot.gameId.substring(0, 8)} [amount]\` to enter!` }
                );
              
              await jackpotMessage.edit({ embeds: [updatedEmbed] });
            }
          }
        }
      } catch (error) {
        logger.error('EnterJackpot', 'Failed to update jackpot message', error);
        // Don't throw error here, just log it
      }
      
      logger.info('EnterJackpot', `User ${message.author.id} entered jackpot ${jackpot.gameId}`, {
        amount,
        totalPot: updatedJackpot.totalPot,
        winChance
      });
    } catch (error) {
      logger.error('EnterJackpot', 'Error in prefix command', error);
      message.reply(`❌ Error: ${error.message}`);
    }
  },
  
  // Command aliases
  aliases: ['enterjackpot', 'ejp']
};