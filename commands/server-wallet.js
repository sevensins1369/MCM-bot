// commands/server-wallet.js
// Command to manage the server wallet

const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { parseAmount } = require('../utils/parseAmount');
const { WalletManager } = require('../utils/WalletManager');
const { ServerWalletManager } = require('../utils/serverwalletmanager');
const { EMOJIS, formatAmount } = require('../utils/embedcreator');
const { ValidationError, safeExecute } = require('../utils/error-handler');

module.exports = {
  // Slash command definition
  data: new SlashCommandBuilder()
    .setName('server-wallet')
    .setDescription('Manage the server wallet')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View the server wallet'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add funds to the server wallet')
        .addStringOption(option => 
          option.setName('amount')
            .setDescription('The amount to add')
            .setRequired(true))
        .addStringOption(option => 
          option.setName('currency')
            .setDescription('The currency to add')
            .setRequired(true)
            .addChoices(
              { name: 'OSRS', value: 'osrs' },
              { name: 'RS3', value: 'rs3' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove funds from the server wallet')
        .addStringOption(option => 
          option.setName('amount')
            .setDescription('The amount to remove')
            .setRequired(true))
        .addStringOption(option => 
          option.setName('currency')
            .setDescription('The currency to remove')
            .setRequired(true)
            .addChoices(
              { name: 'OSRS', value: 'osrs' },
              { name: 'RS3', value: 'rs3' }
            ))),
  
  // Slash command execution
  async execute(interaction) {
    return await safeExecute(async () => {
      // Check if user is an admin
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        throw new ValidationError('You do not have permission to use this command.');
      }
      
      const subcommand = interaction.options.getSubcommand();
      
      if (subcommand === 'view') {
        // Get server wallet
        const serverWallet = await ServerWalletManager.getServerWallet(interaction.guild.id);
        
        // Create embed
        const embed = new EmbedBuilder()
          .setTitle(`${EMOJIS.stash} Server Wallet`)
          .setColor(0xDAA520)
          .setDescription(`Server wallet for ${interaction.guild.name}`)
          .addFields(
            { name: 'OSRS', value: formatAmount(serverWallet.osrs), inline: true },
            { name: 'RS3', value: formatAmount(serverWallet.rs3), inline: true }
          )
          .setTimestamp()
          .setFooter({ text: 'Server Wallet' });
        
        // Send embed
        await interaction.reply({
          embeds: [embed]
        });
      } else if (subcommand === 'add') {
        // Get options
        const amountStr = interaction.options.getString('amount');
        const currency = interaction.options.getString('currency');
        
        // Parse amount
        const parsedAmount = await parseAmount(amountStr, interaction.user.id, currency);
        if (!parsedAmount.success) {
          throw new ValidationError(parsedAmount.message);
        }
        
        const amount = parsedAmount.amount;
        
        // Get server wallet
        const serverWallet = await ServerWalletManager.getServerWallet(interaction.guild.id);
        
        // Add funds
        serverWallet[currency] = BigInt(serverWallet[currency]) + amount;
        
        // Update server wallet
        await ServerWalletManager.updateServerWallet(interaction.guild.id, serverWallet);
        
        // Create embed
        const embed = new EmbedBuilder()
          .setTitle(`${EMOJIS.stash} Server Wallet Updated`)
          .setColor(0xDAA520)
          .setDescription(`Added ${formatAmount(amount)} ${currency.toUpperCase()} to the server wallet.`)
          .addFields(
            { name: 'New Balance', value: formatAmount(serverWallet[currency]) + ' ' + currency.toUpperCase(), inline: true }
          )
          .setTimestamp()
          .setFooter({ text: 'Server Wallet' });
        
        // Send embed
        await interaction.reply({
          embeds: [embed]
        });
      } else if (subcommand === 'remove') {
        // Get options
        const amountStr = interaction.options.getString('amount');
        const currency = interaction.options.getString('currency');
        
        // Parse amount
        const parsedAmount = await parseAmount(amountStr, interaction.user.id, currency);
        if (!parsedAmount.success) {
          throw new ValidationError(parsedAmount.message);
        }
        
        const amount = parsedAmount.amount;
        
        // Get server wallet
        const serverWallet = await ServerWalletManager.getServerWallet(interaction.guild.id);
        
        // Check if server has enough funds
        if (BigInt(serverWallet[currency]) < amount) {
          throw new ValidationError(`Server wallet doesn't have enough ${currency.toUpperCase()}.`);
        }
        
        // Remove funds
        serverWallet[currency] = BigInt(serverWallet[currency]) - amount;
        
        // Update server wallet
        await ServerWalletManager.updateServerWallet(interaction.guild.id, serverWallet);
        
        // Create embed
        const embed = new EmbedBuilder()
          .setTitle(`${EMOJIS.stash} Server Wallet Updated`)
          .setColor(0xDAA520)
          .setDescription(`Removed ${formatAmount(amount)} ${currency.toUpperCase()} from the server wallet.`)
          .addFields(
            { name: 'New Balance', value: formatAmount(serverWallet[currency]) + ' ' + currency.toUpperCase(), inline: true }
          )
          .setTimestamp()
          .setFooter({ text: 'Server Wallet' });
        
        // Send embed
        await interaction.reply({
          embeds: [embed]
        });
      }
    }, interaction);
  },
  
  // Prefix command execution
  async run(message, args) {
    return await safeExecute(async () => {
      // Check if user is an admin
      if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        throw new ValidationError('You do not have permission to use this command.');
      }
      
      // Check arguments
      if (args.length < 1) {
        throw new ValidationError('Usage: !server-wallet <view|add|remove> [amount] [currency]');
      }
      
      const subcommand = args[0].toLowerCase();
      
      if (subcommand === 'view') {
        // Get server wallet
        const serverWallet = await ServerWalletManager.getServerWallet(message.guild.id);
        
        // Create embed
        const embed = new EmbedBuilder()
          .setTitle(`${EMOJIS.stash} Server Wallet`)
          .setColor(0xDAA520)
          .setDescription(`Server wallet for ${message.guild.name}`)
          .addFields(
            { name: 'OSRS', value: formatAmount(serverWallet.osrs), inline: true },
            { name: 'RS3', value: formatAmount(serverWallet.rs3), inline: true }
          )
          .setTimestamp()
          .setFooter({ text: 'Server Wallet' });
        
        // Send embed
        await message.reply({
          embeds: [embed]
        });
      } else if (subcommand === 'add') {
        // Check arguments
        if (args.length < 3) {
          throw new ValidationError('Usage: !server-wallet add <amount> <currency>');
        }
        
        // Get options
        const amountStr = args[1];
        const currency = args[2].toLowerCase();
        
        // Validate currency
        if (currency !== 'osrs' && currency !== 'rs3') {
          throw new ValidationError('Invalid currency. Must be "osrs" or "rs3".');
        }
        
        // Parse amount
        const parsedAmount = await parseAmount(amountStr, message.author.id, currency);
        if (!parsedAmount.success) {
          throw new ValidationError(parsedAmount.message);
        }
        
        const amount = parsedAmount.amount;
        
        // Get server wallet
        const serverWallet = await ServerWalletManager.getServerWallet(message.guild.id);
        
        // Add funds
        serverWallet[currency] = BigInt(serverWallet[currency]) + amount;
        
        // Update server wallet
        await ServerWalletManager.updateServerWallet(message.guild.id, serverWallet);
        
        // Create embed
        const embed = new EmbedBuilder()
          .setTitle(`${EMOJIS.stash} Server Wallet Updated`)
          .setColor(0xDAA520)
          .setDescription(`Added ${formatAmount(amount)} ${currency.toUpperCase()} to the server wallet.`)
          .addFields(
            { name: 'New Balance', value: formatAmount(serverWallet[currency]) + ' ' + currency.toUpperCase(), inline: true }
          )
          .setTimestamp()
          .setFooter({ text: 'Server Wallet' });
        
        // Send embed
        await message.reply({
          embeds: [embed]
        });
      } else if (subcommand === 'remove') {
        // Check arguments
        if (args.length < 3) {
          throw new ValidationError('Usage: !server-wallet remove <amount> <currency>');
        }
        
        // Get options
        const amountStr = args[1];
        const currency = args[2].toLowerCase();
        
        // Validate currency
        if (currency !== 'osrs' && currency !== 'rs3') {
          throw new ValidationError('Invalid currency. Must be "osrs" or "rs3".');
        }
        
        // Parse amount
        const parsedAmount = await parseAmount(amountStr, message.author.id, currency);
        if (!parsedAmount.success) {
          throw new ValidationError(parsedAmount.message);
        }
        
        const amount = parsedAmount.amount;
        
        // Get server wallet
        const serverWallet = await ServerWalletManager.getServerWallet(message.guild.id);
        
        // Check if server has enough funds
        if (BigInt(serverWallet[currency]) < amount) {
          throw new ValidationError(`Server wallet doesn't have enough ${currency.toUpperCase()}.`);
        }
        
        // Remove funds
        serverWallet[currency] = BigInt(serverWallet[currency]) - amount;
        
        // Update server wallet
        await ServerWalletManager.updateServerWallet(message.guild.id, serverWallet);
        
        // Create embed
        const embed = new EmbedBuilder()
          .setTitle(`${EMOJIS.stash} Server Wallet Updated`)
          .setColor(0xDAA520)
          .setDescription(`Removed ${formatAmount(amount)} ${currency.toUpperCase()} from the server wallet.`)
          .addFields(
            { name: 'New Balance', value: formatAmount(serverWallet[currency]) + ' ' + currency.toUpperCase(), inline: true }
          )
          .setTimestamp()
          .setFooter({ text: 'Server Wallet' });
        
        // Send embed
        await message.reply({
          embeds: [embed]
        });
      } else {
        throw new ValidationError('Invalid subcommand. Valid subcommands: view, add, remove');
      }
    }, message);
  },
  
  // Command aliases
  aliases: ['sw', 'serverwallet']
};