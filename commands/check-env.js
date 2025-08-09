// commands/check-env.js
// Command to check environment variables

const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  // Slash command definition
  data: new SlashCommandBuilder()
    .setName('check-env')
    .setDescription('Check environment variables')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  // Slash command execution
  async execute(interaction) {
    // Check if user is an admin
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        ephemeral: true
      });
    }
    
    // Create embed with environment variables
    const embed = new EmbedBuilder()
      .setTitle('Environment Variables')
      .setColor(0x0099FF)
      .setDescription('Current environment variables:')
      .addFields(
        { name: 'NODE_ENV', value: process.env.NODE_ENV || 'Not set', inline: true },
        { name: 'PREFIX', value: process.env.PREFIX || 'Not set', inline: true },
        { name: 'MONGODB_URI', value: process.env.MONGODB_URI ? 'Set (hidden)' : 'Not set', inline: true },
        { name: 'TOKEN', value: 'Set (hidden)', inline: true },
        { name: 'CLIENT_ID', value: process.env.CLIENT_ID ? 'Set (hidden)' : 'Not set', inline: true },
        { name: 'GUILD_ID', value: process.env.GUILD_ID ? 'Set (hidden)' : 'Not set', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'Environment Check' });
    
    // Send embed
    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  },
  
  // Prefix command execution
  async run(message, args) {
    // Check if user is an admin
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('You do not have permission to use this command.');
    }
    
    // Create embed with environment variables
    const embed = new EmbedBuilder()
      .setTitle('Environment Variables')
      .setColor(0x0099FF)
      .setDescription('Current environment variables:')
      .addFields(
        { name: 'NODE_ENV', value: process.env.NODE_ENV || 'Not set', inline: true },
        { name: 'PREFIX', value: process.env.PREFIX || 'Not set', inline: true },
        { name: 'MONGODB_URI', value: process.env.MONGODB_URI ? 'Set (hidden)' : 'Not set', inline: true },
        { name: 'TOKEN', value: 'Set (hidden)', inline: true },
        { name: 'CLIENT_ID', value: process.env.CLIENT_ID ? 'Set (hidden)' : 'Not set', inline: true },
        { name: 'GUILD_ID', value: process.env.GUILD_ID ? 'Set (hidden)' : 'Not set', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'Environment Check' });
    
    // Send embed
    await message.reply({ embeds: [embed] });
  }
};