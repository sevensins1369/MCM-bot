// commands/wallet.js
const { SlashCommandBuilder } = require("discord.js");
const { getWallet } = require("../utils/WalletManager");
const { formatAmount } = require("../utils/embedcreator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("wallet")
    .setDescription("Check your wallet balance"),

  async execute(interaction) {
    try {
      // Check if the wallet is private before deferring the reply
      const userId = interaction.user.id;
      const wallet = await getWallet(userId);

      // If wallet is private, make the response ephemeral
      const ephemeral = wallet.isPrivate;

      await interaction.deferReply({ ephemeral });

      // Format amounts
      const osrsFormatted = formatAmount(wallet.osrs);
      const rs3Formatted = formatAmount(wallet.rs3);

      // Create embed
      const embed = {
        color: 0x3498db,
        title: `${interaction.user.username}'s Wallet`,
        thumbnail: {
          url: interaction.user.displayAvatarURL({ dynamic: true }),
        },
        fields: [
          {
            name: "💰 osrs",
            value: osrsFormatted,
            inline: true,
          },
          {
            name: "💰 RS3",
            value: rs3Formatted,
            inline: true,
          },
        ],
        footer: {
          text: wallet.isPrivate ? "🔒 Private Wallet" : "🔓 Public Wallet",
        },
        timestamp: new Date(),
      };

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in wallet command:", error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: "❌ An error occurred while retrieving your wallet.",
        });
      } else {
        await interaction.reply({
          content: "❌ An error occurred while retrieving your wallet.",
          ephemeral: true,
        });
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
          url: message.author.displayAvatarURL({ dynamic: true }),
        },
        fields: [
          {
            name: "💰 osrs",
            value: osrsFormatted,
            inline: true,
          },
          {
            name: "💰 RS3",
            value: rs3Formatted,
            inline: true,
          },
        ],
        footer: {
          text: wallet.isPrivate ? "🔒 Private Wallet" : "🔓 Public Wallet",
        },
        timestamp: new Date(),
      };

      // If wallet is private, send to DM instead of replying in channel
      if (wallet.isPrivate) {
        try {
          await message.author.send({ embeds: [embed] });
          // Send a confirmation in the channel that the wallet was sent privately
          await message.reply({
            content: "🔒 Your wallet information has been sent to your DMs.",
            ephemeral: true,
          });
        } catch (dmError) {
          console.error("Error sending DM:", dmError);
          // If DM fails (e.g., user has DMs disabled), reply in channel but mention it's supposed to be private
          await message.reply({
            content:
              "❌ Unable to send your wallet to DMs. Please enable DMs from server members.",
            ephemeral: true,
          });
        }
      } else {
        // If wallet is public, reply in the channel
        await message.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error("Error in wallet command:", error);
      await message.reply("❌ An error occurred while retrieving your wallet.");
    }
  },
};
