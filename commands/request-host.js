// commands/request-host.js
require("dotenv").config();
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { EMOJIS } = require("../utils/embedcreator");

const HOST_REQUEST_CHANNEL_ID = process.env.HOST_REQUEST_CHANNEL_ID;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("request-host")
    .setDescription("Request a host for your gambling session."),

  async execute(interaction) {
    try {
      if (!HOST_REQUEST_CHANNEL_ID) {
        return interaction.reply({
          content:
            "❌ This feature is not configured by the server admin. Please set HOST_REQUEST_CHANNEL_ID in the .env file.",
          ephemeral: true,
        });
      }

      try {
        const requestChannel = await interaction.client.channels.fetch(
          HOST_REQUEST_CHANNEL_ID
        );

        const embed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle(`${EMOJIS.host} Host Request`)
          .setDescription(
            `${interaction.user.toString()} is looking for a host.`
          )
          .setTimestamp()
          .setFooter({ text: `User ID: ${interaction.user.id}` });

        await requestChannel.send({
          content: `<@&${process.env.HOST_ROLE_ID || ""}>`,
          embeds: [embed],
        });
        await interaction.reply({
          content:
            "✅ Your host request has been submitted. A host will be with you shortly.",
          ephemeral: true,
        });
      } catch (channelError) {
        console.error("Error fetching host request channel:", channelError);
        await interaction.reply({
          content:
            "❌ Could not find the host request channel. Please contact an administrator.",
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Error in /request-host command:", error);
      await interaction.reply({
        content: "❌ An error occurred while submitting your host request.",
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      if (!HOST_REQUEST_CHANNEL_ID) {
        return message.reply(
          "❌ This feature is not configured by the server admin. Please set HOST_REQUEST_CHANNEL_ID in the .env file."
        );
      }

      try {
        const requestChannel = await message.client.channels.fetch(
          HOST_REQUEST_CHANNEL_ID
        );

        const embed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle(`${EMOJIS.host} Host Request`)
          .setDescription(`${message.author.toString()} is looking for a host.`)
          .setTimestamp()
          .setFooter({ text: `User ID: ${message.author.id}` });

        await requestChannel.send({
          content: `<@&${process.env.HOST_ROLE_ID || ""}>`,
          embeds: [embed],
        });
        await message.reply(
          "✅ Your host request has been submitted. A host will be with you shortly."
        );
      } catch (channelError) {
        console.error("Error fetching host request channel:", channelError);
        await message.reply(
          "❌ Could not find the host request channel. Please contact an administrator."
        );
      }
    } catch (error) {
      console.error("Error in !request-host command:", error);
      await message.reply(
        "❌ An error occurred while submitting your host request."
      );
    }
  },
};

// This command allows users to request a host for a game.
// It checks if the required IDs are configured, fetches the request channel, and sends a message tagging the host role.
// If successful, it confirms the request to the user; otherwise, it handles errors gracefully.
