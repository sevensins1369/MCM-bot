// commands/flowerbetting.js
// Command to open or close betting for a flower game

const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const {
  getFlowerGame,
  closeBetting,
  createFlowerGameEmbed,
} = require("../utils/FlowerGameManager");
const { EMOJIS } = require("../utils/embedcreator");
const {
  ValidationError,
  withErrorHandling,
} = require("../utils/error-handler");

module.exports = {
  // Slash command definition
  data: new SlashCommandBuilder()
    .setName("flowerbetting")
    .setDescription("Open or close betting for your flower game")
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("Whether to open or close betting")
        .setRequired(true)
        .addChoices(
          { name: "Open", value: "open" },
          { name: "Close", value: "close" }
        )
    ),

  // Slash command execution
  execute: withErrorHandling(async function (interaction) {
    // Get options
    const action = interaction.options.getString("action");

    // Get the flower game
    const game = getFlowerGame(interaction.user.id);
    if (!game) {
      throw new ValidationError("You do not have an active flower game.");
    }

    if (action === "open") {
      // Check if betting is already open
      if (game.isOpen) {
        throw new ValidationError(
          "Betting is already open for your flower game."
        );
      }

      // Open betting
      game.isOpen = true;

      // Update in database if using MongoDB
      if (require("../utils/database").isUsingMongoDB()) {
        try {
          await require("../models/FlowerGame").updateOne(
            { hostId: interaction.user.id },
            { $set: { isOpen: true } }
          );
        } catch (error) {
          console.error("Failed to update flower game in database:", error);
        }
      } else {
        const { saveFlowerGamesToFile } = require("../utils/FlowerGameManager");
        saveFlowerGamesToFile();
      }

      // Create embed
      const embed = await createFlowerGameEmbed(
        game,
        interaction.user,
        interaction.client
      );

      // Send embed
      await interaction.reply({
        content: `${EMOJIS.bet} Betting is now OPEN for your ${formatGameType(
          game.gameType
        )} game.`,
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
    } else {
      // Check if betting is already closed
      if (!game.isOpen) {
        throw new ValidationError(
          "Betting is already closed for your flower game."
        );
      }

      // Close betting
      await closeBetting(interaction.user.id);

      // Send response
      await interaction.reply({
        content: `${
          EMOJIS.closed
        } Betting is now CLOSED for your ${formatGameType(
          game.gameType
        )} game. Use \`/setflowers\` to select flowers.`,
      });
    }
  }, "FlowerBettingCommand"),

  // Prefix command execution
  async run(message, args) {
    try {
      // Check arguments
      if (args.length < 1) {
        throw new ValidationError("Usage: !flowerbetting <open|close>");
      }

      // Get action
      const action = args[0].toLowerCase();
      if (action !== "open" && action !== "close") {
        throw new ValidationError('Invalid action. Use "open" or "close".');
      }

      // Get the flower game
      const game = getFlowerGame(message.author.id);
      if (!game) {
        throw new ValidationError("You do not have an active flower game.");
      }

      if (action === "open") {
        // Check if betting is already open
        if (game.isOpen) {
          throw new ValidationError(
            "Betting is already open for your flower game."
          );
        }

        // Open betting
        game.isOpen = true;

        // Update in database if using MongoDB
        if (require("../utils/database").isUsingMongoDB()) {
          try {
            await require("../models/FlowerGame").updateOne(
              { hostId: message.author.id },
              { $set: { isOpen: true } }
            );
          } catch (error) {
            console.error("Failed to update flower game in database:", error);
          }
        } else {
          const {
            saveFlowerGamesToFile,
          } = require("../utils/FlowerGameManager");
          saveFlowerGamesToFile();
        }

        // Create embed
        const embed = await createFlowerGameEmbed(
          game,
          message.author,
          message.client
        );

        // Send embed
        await message.reply({
          content: `${EMOJIS.bet} Betting is now OPEN for your ${formatGameType(
            game.gameType
          )} game.`,
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
      } else {
        // Check if betting is already closed
        if (!game.isOpen) {
          throw new ValidationError(
            "Betting is already closed for your flower game."
          );
        }

        // Close betting
        await closeBetting(message.author.id);

        // Send response
        await message.reply({
          content: `${
            EMOJIS.closed
          } Betting is now CLOSED for your ${formatGameType(
            game.gameType
          )} game. Use \`!setflowers\` to select flowers.`,
        });
      }
    } catch (error) {
      // Handle errors for prefix command
      if (error instanceof ValidationError) {
        await message.reply(`⚠️ ${error.message}`);
      } else {
        console.error("Error in !flowerbetting command:", error);
        await message.reply(
          "❌ An error occurred while managing flower betting."
        );
      }
    }
  },

  // Command aliases
  aliases: ["fb-betting", "fbb"],
};

// Helper function to format game type for display
function formatGameType(gameType) {
  switch (gameType) {
    case "hot_cold":
      return "Hot/Cold";
    case "flower_poker":
      return "Flower Poker";
    case "rainbow_mania":
      return "Rainbow Mania";
    default:
      return gameType.charAt(0).toUpperCase() + gameType.slice(1);
  }
}
