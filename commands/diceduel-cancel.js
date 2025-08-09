// commands/diceduel-cancel.js
const { SlashCommandBuilder } = require("discord.js");
const { cancelDiceDuel } = require("../utils/DiceDuelManager");
const { logger } = require("../utils/enhanced-logger");
const {
  withErrorHandling,
  ValidationError,
} = require("../utils/error-handler");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("diceduel-cancel")
    .setDescription("Cancel your active dice duel"),

  execute: withErrorHandling(async function (interaction) {
    await interaction.deferReply();

    const userId = interaction.user.id;

    // Cancel the duel
    const result = await cancelDiceDuel(userId);

    if (!result.success) {
      throw new ValidationError(result.message);
    }

    await interaction.editReply("✅ Your dice duel has been cancelled.");

    // Log the cancellation
    logger.info("DiceDuel", `User ${userId} cancelled their dice duel`);
  }, "DiceDuelCancelCommand"),

  // For prefix command usage
  async run(message, args) {
    try {
      const userId = message.author.id;

      // Cancel the duel
      const result = await cancelDiceDuel(userId);

      if (!result.success) {
        return message.reply(`❌ ${result.message}`);
      }

      await message.reply("✅ Your dice duel has been cancelled.");

      // Log the cancellation
      logger.info("DiceDuel", `User ${userId} cancelled their dice duel`);
    } catch (error) {
      logger.error("DiceDuel", "Error in !diceduel-cancel command", error);
      return message.reply("❌ An error occurred while cancelling the duel.");
    }
  },

  // Command aliases
  aliases: ["ddc"],
};
