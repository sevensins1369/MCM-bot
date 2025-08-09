// commands/hoststatus.js
require("dotenv").config();
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { EMOJIS } = require("../utils/embedcreator");

// Get role IDs from your .env file
const HOST_ROLE_ID = process.env.HOST_ROLE_ID;
const HOST_NOTIFY_ROLE_ID = process.env.HOST_NOTIFY_ROLE_ID;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("hoststatus")
    .setDescription("Update your hosting status in the current channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages) // Any member with host role can use
    .addSubcommand((subcommand) =>
      subcommand
        .setName("open")
        .setDescription("Announce that you are now hosting.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("close")
        .setDescription("Announce that you are no longer hosting.")
    ),

  async execute(interaction) {
    // Check if the required role IDs are configured
    if (!HOST_ROLE_ID || !HOST_NOTIFY_ROLE_ID) {
      return interaction.reply({
        content:
          "❌ This command is not configured correctly. Role IDs are missing. Please contact an administrator.",
        ephemeral: true,
      });
    }

    // Check if the user has the host role
    if (!interaction.member.roles.cache.has(HOST_ROLE_ID)) {
      return interaction.reply({
        content: "❌ Only users with the Host role can use this command.",
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const hostUser = interaction.user;

    // The announcement will be sent in the channel where the command was used
    const announcementChannel = interaction.channel;

    if (subcommand === "open") {
      try {
        // First, send an ephemeral confirmation to the host
        await interaction.reply({
          content: `✅ Posting your "open" announcement now...`,
          ephemeral: true,
        });

        // Then, send the public announcement in the channel
        await announcementChannel.send({
          content: `${
            EMOJIS.host
          } <@&${HOST_NOTIFY_ROLE_ID}>, host ${hostUser.toString()} is now open for business!`,
        });
      } catch (error) {
        console.error("Error sending host open announcement:", error);
        // If sending the public message fails, edit the ephemeral reply
        await interaction.editReply({
          content:
            "❌ Failed to send the announcement. Do I have permission to post in this channel?",
        });
      }
    } else if (subcommand === "close") {
      try {
        // First, send an ephemeral confirmation to the host
        await interaction.reply({
          content: `✅ Posting your "closed" announcement now...`,
          ephemeral: true,
        });

        // Then, send the public announcement in the channel
        await announcementChannel.send({
          content: `${
            EMOJIS.closed
          } Host ${hostUser.toString()} is now closed. Thanks for playing!`,
        });
      } catch (error) {
        console.error("Error sending host close announcement:", error);
        // If sending the public message fails, edit the ephemeral reply
        await interaction.editReply({
          content:
            "❌ Failed to send the announcement. Do I have permission to post in this channel?",
        });
      }
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      // Check if the required role IDs are configured
      if (!HOST_ROLE_ID || !HOST_NOTIFY_ROLE_ID) {
        return message.reply(
          "❌ This command is not configured correctly. Role IDs are missing. Please contact an administrator."
        );
      }

      // Check if the user has the host role
      if (!message.member.roles.cache.has(HOST_ROLE_ID)) {
        return message.reply(
          "❌ Only users with the Host role can use this command."
        );
      }

      if (args.length < 1) {
        return message.reply("❌ Please specify a status: `open` or `close`");
      }

      const subcommand = args[0].toLowerCase();
      const hostUser = message.author;

      // The announcement will be sent in the channel where the command was used
      const announcementChannel = message.channel;

      if (subcommand === "open") {
        try {
          // First, send a confirmation to the host
          const confirmMessage = await message.reply(
            '✅ Posting your "open" announcement now...'
          );

          // Then, send the public announcement in the channel
          await announcementChannel.send({
            content: `${
              EMOJIS.host
            } <@&${HOST_NOTIFY_ROLE_ID}>, host ${hostUser.toString()} is now open for business!`,
          });
        } catch (error) {
          console.error("Error sending host open announcement:", error);
          await message.reply(
            "❌ Failed to send the announcement. Do I have permission to post in this channel?"
          );
        }
      } else if (subcommand === "close") {
        try {
          // First, send a confirmation to the host
          const confirmMessage = await message.reply(
            '✅ Posting your "closed" announcement now...'
          );

          // Then, send the public announcement in the channel
          await announcementChannel.send({
            content: `${
              EMOJIS.closed
            } Host ${hostUser.toString()} is now closed. Thanks for playing!`,
          });
        } catch (error) {
          console.error("Error sending host close announcement:", error);
          await message.reply(
            "❌ Failed to send the announcement. Do I have permission to post in this channel?"
          );
        }
      } else {
        await message.reply("❌ Invalid status. Please use `open` or `close`.");
      }
    } catch (error) {
      console.error("Error in !hoststatus command:", error);
      await message.reply(
        "❌ An error occurred while updating your host status."
      );
    }
  },
};

// This command allows users to announce their hosting status, either opening or closing their availability for duels.
// It checks if the user has the host role, and sends an announcement in a specified channel
