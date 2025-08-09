// commands/wallet.js
const { SlashCommandBuilder } = require('discord.js');
const { getWallet } = require('../utils/WalletManager');
const { formatAmount } = require('../utils/embedcreator');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wallet')
    .setDescription('Check your wallet balance'),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      
      const userId = interaction.user.id;
      const wallet = await getWallet(userId);
      
      // Format amounts
      const osrsFormatted = formatAmount(wallet.osrs);
      const rs3Formatted = formatAmount(wallet.rs3);
      
      // Create embed
      const embed = {
        color: 0x3498db,
        title: `${interaction.user.username}'s Wallet`,
        thumbnail: {
          url: interaction.user.displayAvatarURL({ dynamic: true })
        },
        fields: [
          {
            name: '💰 OSRS',
            value: osrsFormatted,
            inline: true
          },
          {
            name: '💰 RS3',
            value: rs3Formatted,
            inline: true
          }
        ],
        footer: {
          text: wallet.isPrivate ? '🔒 Private Wallet' : '🔓 Public Wallet'
        },
        timestamp: new Date()
      };
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in wallet command:', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: '❌ An error occurred while retrieving your wallet.' });
      } else {
        await interaction.reply({ content: '❌ An error occurred while retrieving your wallet.', ephemeral: true });
      }
    }
  },
  
  // For prefix command usage
  async run(message, args) {
    try {
      const userId = message.author.id;
      const wallet = await getWallet(userId);
      
      // Format amounts
      const osrsFormatted = formatAmount(wallet.osrs);
      const rs3Formatted = formatAmount(wallet.rs3);
      
      // Create embed
      const embed = {
        color: 0x3498db,
        title: `${message.author.username}'s Wallet`,
        thumbnail: {
          url: message.author.displayAvatarURL({ dynamic: true })
        },
        fields: [
          {
            name: '💰 OSRS',
            value: osrsFormatted,
            inline: true
          },
          {
            name: '💰 RS3',
            value: rs3Formatted,
            inline: true
          }
        ],
        footer: {
          text: wallet.isPrivate ? '🔒 Private Wallet' : '🔓 Public Wallet'
        },
        timestamp: new Date()
      };
      
      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in wallet command:', error);
      await message.reply('❌ An error occurred while retrieving your wallet.');
    }
  }
};