// commands/vip.js
require("dotenv").config();
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { EMOJIS } = require("../utils/embedcreator");

const VIP_ROLE_ID = process.env.VIP_ROLE_ID;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vip")
    .setDescription("Access exclusive VIP commands.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("status")
        .setDescription("Check your VIP status and benefits.")
    ),
  // Add more VIP subcommands here in the future

  async execute(interaction) {
    if (!VIP_ROLE_ID) {
      return interaction.reply({
        content:
          "❌ The VIP system is not configured. Please contact an administrator.",
        ephemeral: true,
      });
    }

    // Check if the user has the VIP role
    if (!interaction.member.roles.cache.has(VIP_ROLE_ID)) {
      return interaction.reply({
        content: "❌ This command is for VIP members only.",
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "status") {
      const embed = new EmbedBuilder()
        .setColor(0xdaa520)
        .setTitle(`${EMOJIS.diamond} VIP Status`)
        .setDescription(
          `Welcome, ${interaction.user.username}! Thank you for being a valued VIP member.`
        )
        .addFields({
          name: "Your Benefits",
          value:
            "- Access to VIP-only channels.\n- Special chat color.\n- More features coming soon!",
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      if (!VIP_ROLE_ID) {
        return message.reply(
          "❌ The VIP system is not configured. Please contact an administrator."
        );
      }

      // Check if the user has the VIP role
      if (!message.member.roles.cache.has(VIP_ROLE_ID)) {
        return message.reply("❌ This command is for VIP members only.");
      }

      const subcommand = args[0]?.toLowerCase() || "status";

      if (subcommand === "status") {
        const embed = new EmbedBuilder()
          .setColor(0xdaa520)
          .setTitle(`${EMOJIS.diamond} VIP Status`)
          .setDescription(
            `Welcome, ${message.author.username}! Thank you for being a valued VIP member.`
          )
          .addFields({
            name: "Your Benefits",
            value:
              "- Access to VIP-only channels.\n- Special chat color.\n- More features coming soon!",
          })
          .setTimestamp();

        await message.reply({ embeds: [embed] });
      } else {
        await message.reply(
          "❌ Invalid subcommand. Available subcommands: `status`"
        );
      }
    } catch (error) {
      console.error("Error in !vip command:", error);
      await message.reply(
        "❌ An error occurred while processing your VIP command."
      );
    }
  },
};

// This command allows users with the VIP role to access exclusive commands.
// It currently includes a subcommand to check VIP status and benefits, with more features planned for the future.
