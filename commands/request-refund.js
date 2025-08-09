// commands/request-refund.js
require("dotenv").config();
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { EMOJIS } = require("../utils/embedcreator");

const REFUND_CHANNEL_ID = process.env.REFUND_CHANNEL_ID;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("request-refund")
    .setDescription("Request a refund from a host.")
    .addUserOption((option) =>
      option
        .setName("host")
        .setDescription("The host to request a refund from.")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for the refund request.")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      if (!REFUND_CHANNEL_ID) {
        return interaction.reply({
          content:
            "❌ This feature is not configured by the server admin. Please set REFUND_CHANNEL_ID in the .env file.",
          ephemeral: true,
        });
      }

      const host = interaction.options.getUser("host");
      const reason =
        interaction.options.getString("reason") || "No reason provided";

      try {
        const refundChannel = await interaction.client.channels.fetch(
          REFUND_CHANNEL_ID
        );

        const embed = new EmbedBuilder()
          .setColor(0xffa500)
          .setTitle(`${EMOJIS.loss} Refund Request`)
          .setDescription(
            `${interaction.user.toString()} is requesting a refund from ${host.toString()}.`
          )
          .addFields({ name: "Reason", value: reason })
          .setTimestamp()
          .setFooter({
            text: `User ID: ${interaction.user.id} | Host ID: ${host.id}`,
          });

        await refundChannel.send({
          content: `<@&${process.env.HOST_ROLE_ID || ""}> <@${host.id}>`,
          embeds: [embed],
        });
        await interaction.reply({
          content:
            "✅ Your refund request has been submitted. A staff member will review it shortly.",
          ephemeral: true,
        });
      } catch (channelError) {
        console.error("Error fetching refund channel:", channelError);
        await interaction.reply({
          content:
            "❌ Could not find the refund channel. Please contact an administrator.",
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Error in /request-refund command:", error);
      await interaction.reply({
        content: "❌ An error occurred while submitting your refund request.",
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      if (!REFUND_CHANNEL_ID) {
        return message.reply(
          "❌ This feature is not configured by the server admin. Please set REFUND_CHANNEL_ID in the .env file."
        );
      }

      if (args.length < 1) {
        return message.reply(
          "❌ Please specify a host. Format: `!request-refund <host> [reason]`"
        );
      }

      // Parse arguments
      const hostMention = args[0];
      const hostId = hostMention.replace(/[<@!>]/g, "");
      const host = await message.client.users.fetch(hostId).catch(() => null);

      if (!host) {
        return message.reply(
          "❌ Invalid host mention. Please mention a valid user."
        );
      }

      // Get reason (all arguments after the host mention)
      const reason = args.slice(1).join(" ") || "No reason provided";

      try {
        const refundChannel = await message.client.channels.fetch(
          REFUND_CHANNEL_ID
        );

        const embed = new EmbedBuilder()
          .setColor(0xffa500)
          .setTitle(`${EMOJIS.loss} Refund Request`)
          .setDescription(
            `${message.author.toString()} is requesting a refund from ${host.toString()}.`
          )
          .addFields({ name: "Reason", value: reason })
          .setTimestamp()
          .setFooter({
            text: `User ID: ${message.author.id} | Host ID: ${host.id}`,
          });

        await refundChannel.send({
          content: `<@&${process.env.HOST_ROLE_ID || ""}> <@${host.id}>`,
          embeds: [embed],
        });
        await message.reply(
          "✅ Your refund request has been submitted. A staff member will review it shortly."
        );
      } catch (channelError) {
        console.error("Error fetching refund channel:", channelError);
        await message.reply(
          "❌ Could not find the refund channel. Please contact an administrator."
        );
      }
    } catch (error) {
      console.error("Error in !request-refund command:", error);
      await message.reply(
        "❌ An error occurred while submitting your refund request."
      );
    }
  },
};

// This command allows users to request a refund from a specific host.
// It checks if the host has the required role, fetches the refund request channel, and
