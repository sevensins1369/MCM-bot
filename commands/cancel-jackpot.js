// commands/cancel-jackpot.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { cancelJackpot, getJackpot } = require('../utils/JackpotManager');
const { formatAmount, EMOJIS } = require('../utils/embedcreator');
const { logger } = require('../enhanced-logger');
const { withErrorHandling, checkPermissions, ValidationError } = require('../error-handler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cancel-jackpot')
    .setDescription('Cancel a jackpot game and refund all entries (Admin only)')
    .addStringOption(option => 
      option
        .setName('game_id')
        .setDescription('The ID of the jackpot game to cancel')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  execute: withErrorHandling(async function(interaction) {
    await interaction.deferReply();
    
    // Check permissions
    checkPermissions(interaction.member, [PermissionFlagsBits.Administrator]);
    
    // Get options
    const gameIdInput = interaction.options.getString('game_id');
    
    // Find jackpot by partial ID
    const activeJackpots = require('../utils/JackpotManager').getActiveJackpots();
    const jackpot = activeJackpots.find(j => j.gameId.startsWith(gameIdInput));
    
    if (!jackpot) {
      throw new ValidationError('Jackpot game not found. Please check the ID and try again.');
    }
    
    // Cancel jackpot
    const cancelledJackpot = await cancelJackpot(jackpot.gameId, interaction.user.id);
    
    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS.WARNING} Jackpot Cancelled ${EMOJIS.WARNING}`)
      .setDescription(`Jackpot #${jackpot.gameId.substring(0, 8)} has been cancelled by an administrator.`)
      .addFields(
        { name: 'Currency', value: jackpot.currency.toUpperCase(), inline: true },
        { name: 'Total Pot', value: formatAmount(jackpot.totalPot), inline: true },
        { name: 'Total Entries', value: jackpot.entries.length.toString(), inline: true },
        { name: 'Refund Status', value: 'All entries have been refunded to their respective wallets.', inline: false }
      )
      .setColor('#FF0000') // Red color
      .setTimestamp()
      .setFooter({ text: `Cancelled by ${interaction.user.username}` });
    
    // Send embed
    await interaction.editReply({ embeds: [embed] });
    
    // Update the original jackpot message if possible
    try {
      if (jackpot.messageId && jackpot.channelId) {
        const channel = await interaction.client.channels.fetch(jackpot.channelId);
        if (channel) {
          const message = await channel.messages.fetch(jackpot.messageId);
          if (message) {
            const cancelledEmbed = new EmbedBuilder()
              .setTitle(`${EMOJIS.WARNING} JACKPOT CANCELLED ${EMOJIS.WARNING}`)
              .setDescription(`This jackpot has been cancelled by an administrator. All entries have been refunded.`)
              .addFields(
                { name: 'Currency', value: jackpot.currency.toUpperCase(), inline: true },
                { name: 'Total Pot', value: formatAmount(jackpot.totalPot), inline: true },
                { name: 'Total Entries', value: jackpot.entries.length.toString(), inline: true },
                { name: 'Cancelled By', value: `<@${interaction.user.id}>`, inline: false },
                { name: 'Cancelled At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
              )
              .setColor('#FF0000') // Red color
              .setTimestamp()
              .setFooter({ text: `Game ID: ${jackpot.gameId}` });
            
            await message.edit({ embeds: [cancelledEmbed] });
          }
        }
      }
    } catch (error) {
      logger.error('CancelJackpot', 'Failed to update jackpot message', error);
      // Don't throw error here, just log it
    }
    
    // Send notification to channel
    try {
      if (jackpot.channelId) {
        const channel = await interaction.client.channels.fetch(jackpot.channelId);
        if (channel && channel.id !== interaction.channelId) {
          const notificationEmbed = new EmbedBuilder()
            .setTitle(`${EMOJIS.WARNING} Jackpot Cancelled ${EMOJIS.WARNING}`)
            .setDescription(`Jackpot #${jackpot.gameId.substring(0, 8)} has been cancelled by an administrator.`)
            .addFields(
              { name: 'Currency', value: jackpot.currency.toUpperCase(), inline: true },
              { name: 'Total Pot', value: formatAmount(jackpot.totalPot), inline: true },
              { name: 'Total Entries', value: jackpot.entries.length.toString(), inline: true },
              { name: 'Refund Status', value: 'All entries have been refunded to their respective wallets.', inline: false }
            )
            .setColor('#FF0000') // Red color
            .setTimestamp()
            .setFooter({ text: `Cancelled by ${interaction.user.username}` });
          
          await channel.send({ embeds: [notificationEmbed] });
        }
      }
    } catch (error) {
      logger.error('CancelJackpot', 'Failed to send notification to channel', error);
      // Don't throw error here, just log it
    }
    
    logger.info('CancelJackpot', `Jackpot ${jackpot.gameId} cancelled by ${interaction.user.id}`, {
      totalPot: jackpot.totalPot,
      entries: jackpot.entries.length
    });
  }, 'CancelJackpot'),
  
  // For prefix command usage
  async run(message, args) {
    try {
      // Check permissions
      checkPermissions(message.member, [PermissionFlagsBits.Administrator]);
      
      if (args.length < 1) {
        return message.reply('❌ Usage: `!cancel-jackpot <game_id>`');
      }
      
      // Parse arguments
      const gameIdInput = args[0];
      
      // Find jackpot by partial ID
      const activeJackpots = require('../utils/JackpotManager').getActiveJackpots();
      const jackpot = activeJackpots.find(j => j.gameId.startsWith(gameIdInput));
      
      if (!jackpot) {
        return message.reply('❌ Jackpot game not found. Please check the ID and try again.');
      }
      
      // Cancel jackpot
      const cancelledJackpot = await cancelJackpot(jackpot.gameId, message.author.id);
      
      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`${EMOJIS.WARNING} Jackpot Cancelled ${EMOJIS.WARNING}`)
        .setDescription(`Jackpot #${jackpot.gameId.substring(0, 8)} has been cancelled by an administrator.`)
        .addFields(
          { name: 'Currency', value: jackpot.currency.toUpperCase(), inline: true },
          { name: 'Total Pot', value: formatAmount(jackpot.totalPot), inline: true },
          { name: 'Total Entries', value: jackpot.entries.length.toString(), inline: true },
          { name: 'Refund Status', value: 'All entries have been refunded to their respective wallets.', inline: false }
        )
        .setColor('#FF0000') // Red color
        .setTimestamp()
        .setFooter({ text: `Cancelled by ${message.author.username}` });
      
      // Send embed
      await message.reply({ embeds: [embed] });
      
      // Update the original jackpot message if possible
      try {
        if (jackpot.messageId && jackpot.channelId) {
          const channel = await message.client.channels.fetch(jackpot.channelId);
          if (channel) {
            const jackpotMessage = await channel.messages.fetch(jackpot.messageId);
            if (jackpotMessage) {
              const cancelledEmbed = new EmbedBuilder()
                .setTitle(`${EMOJIS.WARNING} JACKPOT CANCELLED ${EMOJIS.WARNING}`)
                .setDescription(`This jackpot has been cancelled by an administrator. All entries have been refunded.`)
                .addFields(
                  { name: 'Currency', value: jackpot.currency.toUpperCase(), inline: true },
                  { name: 'Total Pot', value: formatAmount(jackpot.totalPot), inline: true },
                  { name: 'Total Entries', value: jackpot.entries.length.toString(), inline: true },
                  { name: 'Cancelled By', value: `<@${message.author.id}>`, inline: false },
                  { name: 'Cancelled At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                )
                .setColor('#FF0000') // Red color
                .setTimestamp()
                .setFooter({ text: `Game ID: ${jackpot.gameId}` });
              
              await jackpotMessage.edit({ embeds: [cancelledEmbed] });
            }
          }
        }
      } catch (error) {
        logger.error('CancelJackpot', 'Failed to update jackpot message', error);
        // Don't throw error here, just log it
      }
      
      // Send notification to channel
      try {
        if (jackpot.channelId) {
          const channel = await message.client.channels.fetch(jackpot.channelId);
          if (channel && channel.id !== message.channelId) {
            const notificationEmbed = new EmbedBuilder()
              .setTitle(`${EMOJIS.WARNING} Jackpot Cancelled ${EMOJIS.WARNING}`)
              .setDescription(`Jackpot #${jackpot.gameId.substring(0, 8)} has been cancelled by an administrator.`)
              .addFields(
                { name: 'Currency', value: jackpot.currency.toUpperCase(), inline: true },
                { name: 'Total Pot', value: formatAmount(jackpot.totalPot), inline: true },
                { name: 'Total Entries', value: jackpot.entries.length.toString(), inline: true },
                { name: 'Refund Status', value: 'All entries have been refunded to their respective wallets.', inline: false }
              )
              .setColor('#FF0000') // Red color
              .setTimestamp()
              .setFooter({ text: `Cancelled by ${message.author.username}` });
            
            await channel.send({ embeds: [notificationEmbed] });
          }
        }
      } catch (error) {
        logger.error('CancelJackpot', 'Failed to send notification to channel', error);
        // Don't throw error here, just log it
      }
      
      logger.info('CancelJackpot', `Jackpot ${jackpot.gameId} cancelled by ${message.author.id}`, {
        totalPot: jackpot.totalPot,
        entries: jackpot.entries.length
      });
    } catch (error) {
      logger.error('CancelJackpot', 'Error in prefix command', error);
      message.reply(`❌ Error: ${error.message}`);
    }
  },
  
  // Command aliases
  aliases: ['canceljackpot', 'cjp']
};