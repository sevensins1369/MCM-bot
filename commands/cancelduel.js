// commands/cancelduel.js
const { SlashCommandBuilder } = require("discord.js");
const { getDuel, cancelDuel } = require("../utils/DuelManager");
const { EMOJIS } = require("../utils/embedcreator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cancelduel")
    .setDescription("Cancel your active duel and refund all bets (Host only)."),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const user = interaction.user;
      const isHost = interaction.member.roles.cache.has(
        process.env.HOST_ROLE_ID
      );
      const isAdmin = interaction.member.permissions.has("Administrator");

      if (!isHost && !isAdmin) {
        return interaction.editReply({
          content: "❌ You do not have permission to use this command.",
        });
      }

      const duel = await getDuel(user.id);
      if (!duel) {
        return interaction.editReply({
          content: "❌ You do not have an active duel.",
        });
      }

      await cancelDuel(user.id);
      await interaction.editReply({
        content: `${EMOJIS.closed} Your duel has been cancelled and all bets have been refunded.`,
      });
    } catch (error) {
      console.error("Error in /cancelduel command:", error);
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: `❌ An error occurred: ${error.message}`,
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      const user = message.author;
      const isHost = message.member.roles.cache.has(process.env.HOST_ROLE_ID);
      const isAdmin = message.member.permissions.has("Administrator");

      if (!isHost && !isAdmin) {
        return message.reply(
          "❌ You do not have permission to use this command."
        );
      }

      const duel = await getDuel(user.id);
      if (!duel) {
        return message.reply("❌ You do not have an active duel.");
      }

      await cancelDuel(user.id);
      await message.reply(
        `${EMOJIS.closed} Your duel has been cancelled and all bets have been refunded.`
      );
    } catch (error) {
      console.error("Error in !cancelduel command:", error);
      await message.reply(`❌ An error occurred: ${error.message}`);
    }
  },
};

// This command allows users to cancel their active duel and refund all bets.
// It fetches the duel details, processes refunds for all bets, and updates the duel status
