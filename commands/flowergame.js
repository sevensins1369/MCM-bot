// commands/flowergame.js
// Command to create a flower game

const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const FlowerGameManager = require("../utils/FlowerGameManager");
const { EMOJIS } = require("../utils/embedcreator");
const UserProfile = require("../models/UserProfile");
const {
  ValidationError,
  withErrorHandling,
} = require("../utils/error-handler");

module.exports = {
  // Slash command definition
  data: new SlashCommandBuilder()
    .setName("flowergame")
    .setDescription("Create a flower game")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("The type of flower game")
        .setRequired(true)
        .addChoices(
          { name: "Hot/Cold", value: "hot_cold" },
          { name: "Pairs", value: "pairs" },
          { name: "Custom", value: "custom" },
          { name: "Flower Poker", value: "flower_poker" },
          { name: "Rainbow Mania", value: "rainbow_mania" }
        )
    ),

  // Slash command execution
  execute: withErrorHandling(async function (interaction) {
    // Get options
    const gameType = interaction.options.getString("type");

    // Check if user already has an active game
    try {
      const existingGame = FlowerGameManager.getFlowerGame(interaction.user.id);
      if (existingGame) {
        throw new ValidationError("You already have an active flower game.");
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      // If error is not ValidationError, continue (game doesn't exist)
    }

    // Create flower game
    const game = await FlowerGameManager.createFlowerGame(
      interaction.user.id,
      gameType
    );

    // Create embed
    const embed = await FlowerGameManager.createFlowerGameEmbed(
      game,
      interaction.user,
      interaction.client
    );

    // Send embed
    await interaction.reply({
      embeds: [embed],
      components: [
        {
          type: 1, // Action Row
          components: [
            {
              type: 2, // Button
              style: 3, // Success (green)
              label: "Close Betting",
              custom_id: `close_betting:${interaction.user.id}`,
            },
            {
              type: 2, // Button
              style: 4, // Danger (red)
              label: "Cancel Game",
              custom_id: `cancel_game:${interaction.user.id}`,
            },
          ],
        },
      ],
    });
  }, "FlowerGameCommand"),

  // Prefix command execution
  async run(message, args) {
    try {
      // Check arguments
      if (args.length < 1) {
        throw new ValidationError("Usage: !flowergame <type>");
      }

      // Get game type
      let gameType;
      const typeArg = args[0].toLowerCase();

      if (
        typeArg === "hot" ||
        typeArg === "cold" ||
        typeArg === "hotcold" ||
        typeArg === "hot_cold" ||
        typeArg === "hot/cold"
      ) {
        gameType = "hot_cold";
      } else if (typeArg === "pairs" || typeArg === "pair") {
        gameType = "pairs";
      } else if (typeArg === "custom") {
        gameType = "custom";
      } else if (
        typeArg === "poker" ||
        typeArg === "flower_poker" ||
        typeArg === "flowerpoker"
      ) {
        gameType = "flower_poker";
      } else if (
        typeArg === "rainbow" ||
        typeArg === "rainbow_mania" ||
        typeArg === "rainbowmania"
      ) {
        gameType = "rainbow_mania";
      } else {
        throw new ValidationError(
          "Invalid game type. Valid types: hot_cold, pairs, custom, flower_poker, rainbow_mania"
        );
      }

      // Check if user already has an active game
      try {
        const existingGame = FlowerGameManager.getFlowerGame(message.author.id);
        if (existingGame) {
          throw new ValidationError("You already have an active flower game.");
        }
      } catch (error) {
        if (error instanceof ValidationError) {
          throw error;
        }
        // If error is not ValidationError, continue (game doesn't exist)
      }

      // Create flower game
      const game = await FlowerGameManager.createFlowerGame(
        message.author.id,
        gameType
      );

      // Create embed
      const embed = await FlowerGameManager.createFlowerGameEmbed(
        game,
        message.author,
        message.client
      );

      // Send embed
      await message.reply({
        embeds: [embed],
        components: [
          {
            type: 1, // Action Row
            components: [
              {
                type: 2, // Button
                style: 3, // Success (green)
                label: "Close Betting",
                custom_id: `close_betting:${message.author.id}`,
              },
              {
                type: 2, // Button
                style: 4, // Danger (red)
                label: "Cancel Game",
                custom_id: `cancel_game:${message.author.id}`,
              },
            ],
          },
        ],
      });
    } catch (error) {
      // Handle errors for prefix command
      if (error instanceof ValidationError) {
        await message.reply(`⚠️ ${error.message}`);
      } else {
        console.error("Error in !flowergame command:", error);
        await message.reply(
          "❌ An error occurred while creating the flower game."
        );
      }
    }
  },

  // Command aliases
  aliases: ["fg"],
};
