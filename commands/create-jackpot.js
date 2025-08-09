// commands/create-jackpot.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { createJackpot, updateJackpotMessage } = require('../utils/JackpotManager');
const { formatAmount, EMOJIS } = require('../utils/embedcreator');
const { logger } = require('../enhanced-logger');
const { withErrorHandling, checkPermissions, validateInput } = require('../error-handler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('create-jackpot')
    .setDescription('Create a new jackpot game (Admin/Mod only)')
    .addStringOption(option => 
      option
        .setName('currency')
        .setDescription('The currency for the jackpot')
        .setRequired(true)
        .addChoices(
          { name: 'OSRS', value: 'osrs' },
          { name: 'RS3', value: 'rs3' }
        )
    )
    .addStringOption(option => 
      option
        .setName('min_entry')
        .setDescription('Minimum entry amount')
        .setRequired(true)
    )
    .addIntegerOption(option => 
      option
        .setName('duration')
        .setDescription('Duration in minutes until the jackpot is drawn')
        .setRequired(true)
        .setMinValue(5)
        .setMaxValue(1440) // Max 24 hours
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  execute: withErrorHandling(async function(interaction) {
    await interaction.deferReply();
    
    // Check permissions
    checkPermissions(interaction.member, [PermissionFlagsBits.ManageMessages]);
    
    // Get options
    const currency = interaction.options.getString('currency');
    const minEntryInput = interaction.options.getString('min_entry');
    const durationMinutes = interaction.options.getInteger('duration');
    
    // Parse min entry amount
    let minEntryAmount;
    try {
      // Remove commas and convert to string
      minEntryAmount = minEntryInput.replace(/,/g, '');
      // Validate that it's a valid number
      BigInt(minEntryAmount);
    } catch (error) {
      throw new ValidationError('Invalid minimum entry amount. Please enter a valid number.');
    }
    
    // Calculate draw time
    const drawTime = new Date(Date.now() + (durationMinutes * 60 * 1000));
    
    // Create jackpot
    const jackpot = await createJackpot({
      currency,
      minEntryAmount,
      drawTime,
      createdBy: interaction.user.id,
      channelId: interaction.channelId,
      serverId: interaction.guildId
    });
    
    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS.JACKPOT} JACKPOT #${jackpot.gameId.substring(0, 8)} ${EMOJIS.JACKPOT}`)
      .setDescription(`A new jackpot has been created! Enter for a chance to win the entire pot!`)
      .addFields(
        { name: 'Currency', value: currency.toUpperCase(), inline: true },
        { name: 'Minimum Entry', value: formatAmount(minEntryAmount), inline: true },
        { name: 'Drawing In', value: `<t:${Math.floor(drawTime.getTime() / 1000)}:R>`, inline: true },
        { name: 'Total Pot', value: `${formatAmount(jackpot.totalPot)} ${currency.toUpperCase()}`, inline: true },
        { name: 'Entries', value: '0', inline: true },
        { name: 'Created By', value: `<@${interaction.user.id}>`, inline: true },
        { name: '\u200B', value: `Use \`/enter-jackpot ${jackpot.gameId.substring(0, 8)} [amount]\` to enter!` }
      )
      .setColor('#FFD700') // Gold color
      .setTimestamp()
      .setFooter({ text: `Game ID: ${jackpot.gameId}` });
    
    // Send embed
    const reply = await interaction.editReply({ embeds: [embed] });
    
    // Update jackpot with message ID
    await updateJackpotMessage(jackpot.gameId, reply.id);
    
    logger.info('CreateJackpot', `Jackpot ${jackpot.gameId} created by ${interaction.user.id}`, {
      currency,
      minEntryAmount,
      drawTime: drawTime.toISOString()
    });
  }, 'CreateJackpot'),
  
  // For prefix command usage
  async run(message, args) {
    try {
      // Check permissions
      checkPermissions(message.member, [PermissionFlagsBits.ManageMessages]);
      
      if (args.length < 3) {
        return message.reply('❌ Usage: `!create-jackpot <currency> <min_entry> <duration_minutes>`');
      }
      
      // Parse arguments
      const currency = args[0].toLowerCase();
      const minEntryInput = args[1];
      const durationMinutes = parseInt(args[2]);
      
      // Validate currency
      if (currency !== 'osrs' && currency !== 'rs3') {
        return message.reply('❌ Invalid currency. Must be "osrs" or "rs3".');
      }
      
      // Parse min entry amount
      let minEntryAmount;
      try {
        // Remove commas and convert to string
        minEntryAmount = minEntryInput.replace(/,/g, '');
        // Validate that it's a valid number
        BigInt(minEntryAmount);
      } catch (error) {
        return message.reply('❌ Invalid minimum entry amount. Please enter a valid number.');
      }
      
      // Validate duration
      if (isNaN(durationMinutes) || durationMinutes < 5 || durationMinutes > 1440) {
        return message.reply('❌ Duration must be between 5 and 1440 minutes (24 hours).');
      }
      
      // Calculate draw time
      const drawTime = new Date(Date.now() + (durationMinutes * 60 * 1000));
      
      // Create jackpot
      const jackpot = await createJackpot({
        currency,
        minEntryAmount,
        drawTime,
        createdBy: message.author.id,
        channelId: message.channelId,
        serverId: message.guildId
      });
      
      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`${EMOJIS.JACKPOT} JACKPOT #${jackpot.gameId.substring(0, 8)} ${EMOJIS.JACKPOT}`)
        .setDescription(`A new jackpot has been created! Enter for a chance to win the entire pot!`)
        .addFields(
          { name: 'Currency', value: currency.toUpperCase(), inline: true },
          { name: 'Minimum Entry', value: formatAmount(minEntryAmount), inline: true },
          { name: 'Drawing In', value: `<t:${Math.floor(drawTime.getTime() / 1000)}:R>`, inline: true },
          { name: 'Total Pot', value: `${formatAmount(jackpot.totalPot)} ${currency.toUpperCase()}`, inline: true },
          { name: 'Entries', value: '0', inline: true },
          { name: 'Created By', value: `<@${message.author.id}>`, inline: true },
          { name: '\u200B', value: `Use \`!enter-jackpot ${jackpot.gameId.substring(0, 8)} [amount]\` to enter!` }
        )
        .setColor('#FFD700') // Gold color
        .setTimestamp()
        .setFooter({ text: `Game ID: ${jackpot.gameId}` });
      
      // Send embed
      const reply = await message.channel.send({ embeds: [embed] });
      
      // Update jackpot with message ID
      await updateJackpotMessage(jackpot.gameId, reply.id);
      
      logger.info('CreateJackpot', `Jackpot ${jackpot.gameId} created by ${message.author.id}`, {
        currency,
        minEntryAmount,
        drawTime: drawTime.toISOString()
      });
    } catch (error) {
      logger.error('CreateJackpot', 'Error in prefix command', error);
      message.reply(`❌ Error: ${error.message}`);
    }
  },
  
  // Command aliases
  aliases: ['createjackpot', 'cjp']
};