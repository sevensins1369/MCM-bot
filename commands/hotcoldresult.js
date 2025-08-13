// commands/hotcoldresult.js
// Command to enter the result of a Hot/Cold game

const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const {
  ValidationError,
  withErrorHandling,
} = require("../utils/error-handler");
const HotColdManager = require("../utils/HotColdManager");
const { EMOJIS } = require("../utils/embedcreator");

module.exports = {
  // Slash command definition
  data: new SlashCommandBuilder()
    .setName("hotcoldresult")
    .setDescription("Enter the result of your Hot/Cold game")
    .addStringOption((option) =>
      option
        .setName("color")
        .setDescription("The color that was rolled")
        .setRequired(true)
        .addChoices(
          { name: `${EMOJIS.REDFIRE || "(HOT)"}`, value: "red" },
          { name: "Orange (HOT)", value: "orange" },
          { name: "Yellow (HOT)", value: "yellow" },
          { name: "Black (HOT)", value: "black" },
          { name: "Blue (COLD)", value: "blue" },
          { name: "Green (COLD)", value: "green" },
          { name: "Purple (COLD)", value: "purple" },
          { name: "White (COLD)", value: "white" }
        )
    ),

  // Slash command execution
  execute: withErrorHandling(async function (interaction) {
    await interaction.deferReply();

    // Get options
    const color = interaction.options.getString("color");

    // Get the game
    const game = HotColdManager.getActiveGame(interaction.user.id);
    if (!game) {
      throw new ValidationError("You do not have an active Hot/Cold game.");
    }

    // Check if betting is still open
    if (game.isOpen) {
      throw new ValidationError(
        "You must close betting before entering the result."
      );
    }

    // Check if result is already set
    if (game.result) {
      throw new ValidationError(
        "You have already entered a result for this game."
      );
    }

    // Set the result
    HotColdManager.setResult(interaction.user.id, color);

    // Process payouts
    const results = await HotColdManager.processPayouts(interaction.user.id);

    // Create results embed
    const resultsEmbed = HotColdManager.createResultsEmbed(
      game,
      results,
      interaction.user
    );

    // Send embed
    await interaction.editReply({
      embeds: [resultsEmbed],
    });
  }, "HotColdResultCommand"),

  // Prefix command execution
  async run(message, args) {
    try {
      // Check arguments
      if (args.length < 1) {
        throw new ValidationError("Usage: !hotcoldresult <color>");
      }

      // Get color
      const color = args[0].toLowerCase();

      // Validate color
      if (!HotColdManager.ALL_COLORS.includes(color)) {
        throw new ValidationError(
          `Invalid color. Valid colors: ${HotColdManager.ALL_COLORS.join(", ")}`
        );
      }

      // Get the game
      const game = HotColdManager.getActiveGame(message.author.id);
      if (!game) {
        throw new ValidationError("You do not have an active Hot/Cold game.");
      }

      // Check if betting is still open
      if (game.isOpen) {
        throw new ValidationError(
          "You must close betting before entering the result."
        );
      }

      // Check if result is already set
      if (game.result) {
        throw new ValidationError(
          "You have already entered a result for this game."
        );
      }

      // Set the result
      HotColdManager.setResult(message.author.id, color);

      // Process payouts
      const results = await HotColdManager.processPayouts(message.author.id);

      // Create results embed
      const resultsEmbed = HotColdManager.createResultsEmbed(
        game,
        results,
        message.author
      );

      // Send embed
      await message.reply({
        embeds: [resultsEmbed],
      });
    } catch (error) {
      // Handle errors for prefix command
      if (error instanceof ValidationError) {
        await message.reply(`⚠️ ${error.message}`);
      } else {
        console.error("Error in !hotcoldresult command:", error);
        await message.reply(
          "❌ An error occurred while processing the result."
        );
      }
    }
  },

  // Command aliases
  aliases: ["hcr"],
};
