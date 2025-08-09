// commands/set-twitch.js
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const UserProfile = require("../models/UserProfile");
const { EMOJIS } = require("../utils/embedcreator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("set-twitch")
    .setDescription("Set your Twitch username to be linked in host embeds.")
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("Your Twitch username (e.g., xqc).")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      // Check if user has Host role or is an Admin
      const isHost = interaction.member.roles.cache.has(
        process.env.HOST_ROLE_ID
      );
      const isAdmin = interaction.member.permissions.has(
        PermissionFlagsBits.Administrator
      );

      if (!isHost && !isAdmin) {
        return interaction.reply({
          content:
            "❌ Only hosts and administrators can set a Twitch username.",
          ephemeral: true,
        });
      }

      const twitchUsername = interaction.options
        .getString("username")
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, ""); // Sanitize input

      await UserProfile.findOneAndUpdate(
        { userId: interaction.user.id },
        { twitchUsername: twitchUsername },
        { upsert: true, new: true }
      );

      await interaction.reply({
        content: `${EMOJIS.win} Your Twitch username has been set to **${twitchUsername}**. It will now appear in your host embeds.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error("Error in /set-twitch command:", error);
      await interaction.reply({
        content: "❌ An error occurred while setting your Twitch username.",
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      // Check if user has Host role or is an Admin
      const isHost = message.member.roles.cache.has(process.env.HOST_ROLE_ID);
      const isAdmin = message.member.permissions.has(
        PermissionFlagsBits.Administrator
      );

      if (!isHost && !isAdmin) {
        return message.reply(
          "❌ Only hosts and administrators can set a Twitch username."
        );
      }

      if (args.length < 1) {
        return message.reply(
          "❌ Please provide your Twitch username. Usage: `!set-twitch <username>`"
        );
      }

      const twitchUsername = args[0].toLowerCase().replace(/[^a-z0-9_]/g, ""); // Sanitize input

      await UserProfile.findOneAndUpdate(
        { userId: message.author.id },
        { twitchUsername: twitchUsername },
        { upsert: true, new: true }
      );

      await message.reply(
        `${EMOJIS.win} Your Twitch username has been set to **${twitchUsername}**. It will now appear in your host embeds.`
      );
    } catch (error) {
      console.error("Error in !set-twitch command:", error);
      await message.reply(
        "❌ An error occurred while setting your Twitch username."
      );
    }
  },
};

// This command allows users to set their Twitch username for host embeds.
// It updates the user's profile in the database and provides feedback on the change.
