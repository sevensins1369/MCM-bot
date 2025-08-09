// events/interactionCreate.js
// Handles Discord interaction events

const { logger } = require("../enhanced-logger");
const { Collection } = require("discord.js");
const {
  ValidationError,
  AuthorizationError,
  DatabaseError,
  ConfigurationError,
} = require("../utils/error-handler");

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    try {
      // Handle different interaction types
      if (interaction.isChatInputCommand()) {
        await handleCommand(interaction, client);
      } else if (interaction.isButton()) {
        await handleButton(interaction, client);
      } else if (interaction.isSelectMenu()) {
        await handleSelectMenu(interaction, client);
      } else if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction, client);
      }
    } catch (error) {
      logger.error("InteractionHandler", "Error handling interaction", {
        error,
      });
    }
  },
};

// Handle slash commands
async function handleCommand(interaction, client) {
  const { commandName } = interaction;

  // Get command from client commands collection
  // Make sure client.commands exists
  if (!client.commands) {
    logger.error(
      "InteractionHandler",
      "Client commands collection is undefined"
    );
    await interaction
      .reply({
        content:
          "Bot commands are not properly initialized. Please contact an administrator.",
        ephemeral: true,
      })
      .catch(() => {});
    return;
  }

  const command = client.commands.get(commandName);
  if (!command) {
    logger.warn("InteractionHandler", `Command not found: ${commandName}`);
    await interaction
      .reply({
        content: `Command not found: ${commandName}`,
        ephemeral: true,
      })
      .catch(() => {});
    return;
  }

  try {
    logger.info(
      "CommandHandler",
      `User ${interaction.user.tag} (${interaction.user.id}) executed command: ${commandName}`
    );
    await command.execute(interaction);
  } catch (error) {
    // Handle different error types
    if (error instanceof ValidationError) {
      logger.warn(
        "CommandHandler",
        `Validation error in command ${commandName}: ${error.message}`
      );

      // If interaction is already replied, follow up with error
      if (interaction.replied || interaction.deferred) {
        await interaction
          .followUp({
            content: `❌ ${error.message}`,
            ephemeral: true,
          })
          .catch(() => {});
      } else {
        // Otherwise, reply with error
        await interaction
          .reply({
            content: `❌ ${error.message}`,
            ephemeral: true,
          })
          .catch(() => {});
      }
    } else if (error instanceof AuthorizationError) {
      logger.warn(
        "CommandHandler",
        `Authorization error in command ${commandName}: ${error.message}`
      );

      if (interaction.replied || interaction.deferred) {
        await interaction
          .followUp({
            content: `⛔ ${error.message}`,
            ephemeral: true,
          })
          .catch(() => {});
      } else {
        await interaction
          .reply({
            content: `⛔ ${error.message}`,
            ephemeral: true,
          })
          .catch(() => {});
      }
    } else if (error instanceof DatabaseError) {
      logger.error(
        "CommandHandler",
        `Database error in command ${commandName}`,
        error
      );

      if (interaction.replied || interaction.deferred) {
        await interaction
          .followUp({
            content: `🔌 Database error: ${error.message}`,
            ephemeral: true,
          })
          .catch(() => {});
      } else {
        await interaction
          .reply({
            content: `🔌 Database error: ${error.message}`,
            ephemeral: true,
          })
          .catch(() => {});
      }
    } else if (error instanceof ConfigurationError) {
      logger.error(
        "CommandHandler",
        `Configuration error in command ${commandName}`,
        error
      );

      if (interaction.replied || interaction.deferred) {
        await interaction
          .followUp({
            content: `⚙️ Configuration error: ${error.message}`,
            ephemeral: true,
          })
          .catch(() => {});
      } else {
        await interaction
          .reply({
            content: `⚙️ Configuration error: ${error.message}`,
            ephemeral: true,
          })
          .catch(() => {});
      }
    } else {
      // Generic error handling
      logger.error(
        "CommandHandler",
        `Error executing command ${commandName}`,
        error
      );

      try {
        if (interaction.replied || interaction.deferred) {
          await interaction
            .followUp({
              content: "There was an error while executing this command!",
              ephemeral: true,
            })
            .catch(() => {});
        } else {
          await interaction
            .reply({
              content: "There was an error while executing this command!",
              ephemeral: true,
            })
            .catch(() => {});
        }
      } catch (replyError) {
        logger.error(
          "CommandHandler",
          `Error replying to interaction for command ${commandName}`,
          replyError
        );
      }
    }
  }
}

// Handle button interactions
async function handleButton(interaction, client) {
  try {
    const { customId } = interaction;
    logger.info(
      "ButtonHandler",
      `User ${interaction.user.username} (${interaction.user.id}) clicked button: ${customId}`
    );

    // Skip handling for cmd_ buttons - these are handled by the collector in commands.js
    if (customId.startsWith("cmd_")) {
      // Let the collector in commands.js handle these
      return;
    }

    // For all other buttons, defer the update first to prevent "Unknown interaction" errors
    await interaction.deferUpdate().catch((e) => {
      logger.warn("ButtonHandler", `Failed to defer update: ${e.message}`);
      // If deferUpdate fails, try deferReply as a fallback
      return interaction.deferReply({ ephemeral: true }).catch((err) => {
        logger.error(
          "ButtonHandler",
          `Failed to defer interaction: ${err.message}`
        );
      });
    });

    // Handle different button types based on customId
    if (customId.startsWith("close_betting:")) {
      await handleCloseFlowerBetting(interaction, customId);
    } else if (customId.startsWith("cancel_game:")) {
      await handleCancelFlowerGame(interaction, customId);
    } else if (customId.startsWith("process_payouts:")) {
      await handleProcessFlowerPayouts(interaction, customId);
    } else if (customId.startsWith("dice_duel_accept_")) {
      await handleDiceDuelAccept(interaction, customId);
    } else if (customId.startsWith("dice_duel_decline_")) {
      await handleDiceDuelDecline(interaction, customId);
    } else if (
      customId.startsWith("minigame_choice:") ||
      customId.startsWith("minigame_color:")
    ) {
      await handleFlowerMinigameChoice(interaction, customId);
    } else if (customId.startsWith("hc_close_betting:")) {
      await handleCloseHotColdBetting(interaction, customId);
    } else if (customId.startsWith("hc_cancel_game:")) {
      await handleCancelHotColdGame(interaction, customId);
    } else if (
      customId.startsWith("sf_flower_") ||
      customId === "sf_confirm" ||
      customId === "sf_reset" ||
      customId === "sf_cancel"
    ) {
      // These are handled by the collector in the setflowers command
      return;
    } else {
      // If button action is not recognized, send a follow-up message
      await interaction
        .followUp({
          content: "This button action is not recognized.",
          ephemeral: true,
        })
        .catch((error) => {
          logger.error("ButtonHandler", "Error sending follow-up message", {
            error,
          });
        });
    }
  } catch (error) {
    logger.error("ButtonHandler", "Error handling button interaction", {
      error,
    });

    // Try to respond to the interaction if possible
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferUpdate().catch(() => {
          // If deferUpdate fails, try deferReply
          return interaction.deferReply({ ephemeral: true }).catch(() => {});
        });
      }

      await interaction
        .followUp({
          content: `Error: ${error.message}`,
          ephemeral: true,
        })
        .catch(() => {});
    } catch (replyError) {
      logger.error("ButtonHandler", "Error sending error message", {
        error: replyError,
      });
    }
  }
}

// Handle select menu interactions
async function handleSelectMenu(interaction, client) {
  try {
    const { customId } = interaction;
    logger.info(
      "SelectMenuHandler",
      `User ${interaction.user.tag} (${interaction.user.id}) used select menu: ${customId}`
    );

    // Defer the reply to prevent "Unknown interaction" error
    await interaction.deferUpdate().catch(() => {
      // If deferUpdate fails, try deferReply
      return interaction.deferReply({ ephemeral: true }).catch(() => {});
    });

    // Handle different select menus based on customId
    if (customId.startsWith("example_menu:")) {
      // Example select menu handler
      await interaction.followUp({
        content: `You selected: ${interaction.values.join(", ")}`,
        ephemeral: true,
      });
    } else {
      await interaction.followUp({
        content: "This select menu action is not recognized.",
        ephemeral: true,
      });
    }
  } catch (error) {
    logger.error(
      "SelectMenuHandler",
      "Error handling select menu interaction",
      { error }
    );

    try {
      // If interaction hasn't been responded to yet, defer update
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferUpdate().catch(() => {
          // If deferUpdate fails, try deferReply
          return interaction.deferReply({ ephemeral: true }).catch(() => {});
        });
      }

      // Then follow up with error message
      await interaction
        .followUp({
          content: `Error: ${error.message}`,
          ephemeral: true,
        })
        .catch(() => {});
    } catch (replyError) {
      logger.error(
        "SelectMenuHandler",
        "Error replying to select menu interaction",
        { error: replyError }
      );
    }
  }
}

// Handle modal submit interactions
async function handleModalSubmit(interaction, client) {
  try {
    const { customId } = interaction;
    logger.info(
      "ModalHandler",
      `User ${interaction.user.tag} (${interaction.user.id}) submitted modal: ${customId}`
    );

    // Defer the reply to prevent "Unknown interaction" error
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    // Handle different modals based on customId
    if (customId.startsWith("example_modal:")) {
      // Example modal handler
      const input = interaction.fields.getTextInputValue("example_input");

      await interaction.editReply({
        content: `You submitted: ${input}`,
        ephemeral: true,
      });
    } else {
      await interaction.editReply({
        content: "This modal action is not recognized.",
        ephemeral: true,
      });
    }
  } catch (error) {
    logger.error("ModalHandler", "Error handling modal submit interaction", {
      error,
    });

    try {
      // If interaction hasn't been responded to yet, defer reply
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
      }

      // Then edit reply with error message
      await interaction
        .editReply({
          content: `Error: ${error.message}`,
          ephemeral: true,
        })
        .catch(() => {});
    } catch (replyError) {
      logger.error(
        "ModalHandler",
        "Error replying to modal submit interaction",
        { error: replyError }
      );
    }
  }
}

// Helper function to handle closing flower betting
async function handleCloseFlowerBetting(interaction, customId) {
  const hostId = customId.split(":")[1];

  // Check if user is the host
  if (interaction.user.id !== hostId) {
    return await interaction.followUp({
      content: "Only the host can close betting.",
      ephemeral: true,
    });
  }

  // Import FlowerGameManager properly
  const FlowerGameManager = require("../utils/FlowerGameManager");

  try {
    // Close betting
    await FlowerGameManager.closeBetting(hostId);

    // Update message
    await interaction.editReply({
      content: "Betting is now closed. Use `/setflowers` to select flowers.",
      components: [],
    });
  } catch (error) {
    logger.error("FlowerGameHandler", "Error closing betting", { error });

    await interaction.followUp({
      content: `Error: ${error.message}`,
      ephemeral: true,
    });
  }
}

// Helper function to handle cancelling flower game
async function handleCancelFlowerGame(interaction, customId) {
  const hostId = customId.split(":")[1];

  // Check if user is the host
  if (interaction.user.id !== hostId) {
    return await interaction.followUp({
      content: "Only the host can cancel the game.",
      ephemeral: true,
    });
  }

  // Import FlowerGameManager properly
  const FlowerGameManager = require("../utils/FlowerGameManager");

  try {
    // Cancel game
    const result = await FlowerGameManager.cancelGame(hostId);

    // Update message
    await interaction.editReply({
      content: `Game cancelled. ${result.refunds.length} bets have been refunded.`,
      components: [],
    });
  } catch (error) {
    logger.error("FlowerGameHandler", "Error cancelling game", { error });

    await interaction.followUp({
      content: `Error: ${error.message}`,
      ephemeral: true,
    });
  }
}

// Helper function to handle processing flower payouts
async function handleProcessFlowerPayouts(interaction, customId) {
  const hostId = customId.split(":")[1];

  // Check if user is the host
  if (interaction.user.id !== hostId) {
    return await interaction.followUp({
      content: "Only the host can process payouts.",
      ephemeral: true,
    });
  }

  // Import FlowerGameManager properly
  const FlowerGameManager = require("../utils/FlowerGameManager");

  try {
    // Process payouts
    const results = await FlowerGameManager.processPayouts(hostId);

    // Update message
    await interaction.editReply({
      content: `Payouts processed. ${results.winners.length} winners, ${results.losers.length} losers.`,
      components: [],
    });
  } catch (error) {
    logger.error("FlowerGameHandler", "Error processing payouts", { error });

    await interaction.followUp({
      content: `Error: ${error.message}`,
      ephemeral: true,
    });
  }
}

// Helper function to handle flower minigame choices
async function handleFlowerMinigameChoice(interaction, customId) {
  // Import FlowerGameManager properly
  const FlowerGameManager = require("../utils/FlowerGameManager");

  try {
    // Parse the choice
    let choice;
    if (customId.startsWith("minigame_choice:")) {
      choice = customId.replace("minigame_choice:", "");
    } else if (customId.startsWith("minigame_color:")) {
      choice = customId.replace("minigame_color:", "");
    }

    // Get the game - FIX: Use a safer way to get the host ID
    let hostId;

    // Try to get hostId from interaction.message.interaction
    if (
      interaction.message.interaction &&
      interaction.message.interaction.user
    ) {
      hostId = interaction.message.interaction.user.id;
    }
    // If that fails, try to get it from the message components
    else if (
      interaction.message.components &&
      interaction.message.components.length > 0
    ) {
      // Look for a button with a custom_id that contains a user ID
      for (const row of interaction.message.components) {
        for (const component of row.components) {
          if (component.custom_id && component.custom_id.includes(":")) {
            const possibleId = component.custom_id.split(":")[1];
            if (possibleId && possibleId.length > 10) {
              // User IDs are long numbers
              hostId = possibleId;
              break;
            }
          }
        }
        if (hostId) break;
      }
    }

    // If we still don't have a hostId, check if this is a follow-up message
    if (!hostId && interaction.message.reference) {
      try {
        const originalMessage = await interaction.channel.messages.fetch(
          interaction.message.reference.messageId
        );
        if (originalMessage.interaction) {
          hostId = originalMessage.interaction.user.id;
        }
      } catch (error) {
        logger.error("FlowerGameHandler", "Error fetching original message", {
          error,
        });
      }
    }

    // If we still don't have a hostId, use the user who clicked the button
    // This is a fallback and might not be correct in all cases
    if (!hostId) {
      hostId = interaction.user.id;

      // Log this situation for debugging
      logger.warn(
        "FlowerGameHandler",
        "Using button clicker's ID as host ID in minigame choice"
      );
    }

    const game = FlowerGameManager.getFlowerGame(hostId);
    if (!game) {
      return await interaction.followUp({
        content: "This game no longer exists.",
        ephemeral: true,
      });
    }

    // Check if minigame is active
    if (!game.minigameActive) {
      return await interaction.followUp({
        content: "This minigame is no longer active.",
        ephemeral: true,
      });
    }

    // Record the player's choice
    const choices = {};
    choices[interaction.user.id] = choice;

    // Process the minigame
    const results = await FlowerGameManager.processRainbowManiaMinigame(
      hostId,
      choices
    );

    // Get the player's result
    const playerResult = results[interaction.user.id];
    if (!playerResult || !playerResult.success) {
      return await interaction.followUp({
        content: `Invalid choice: ${
          playerResult ? playerResult.message : "Unknown error"
        }`,
        ephemeral: true,
      });
    }

    // Send result to player
    await interaction.followUp({
      content: `You chose ${choice} and got a ${playerResult.multiplier}x multiplier!`,
      ephemeral: true,
    });

    // Update the message for everyone
    const { EmbedBuilder } = require("discord.js");
    const embed = new EmbedBuilder()
      .setColor(0xff9800)
      .setTitle("🎮 Minigame Results")
      .setDescription(`The minigame has been completed!`)
      .addFields(
        {
          name: "Minigame Type",
          value: formatMinigameName(game.currentMinigame),
          inline: true,
        },
        {
          name: "Players",
          value: Object.keys(results).length.toString(),
          inline: true,
        }
      );

    await interaction.message
      .edit({
        embeds: [embed],
        components: [],
      })
      .catch((error) => {
        logger.error("FlowerGameHandler", "Error updating minigame message", {
          error,
        });
      });
  } catch (error) {
    logger.error("FlowerGameHandler", "Error handling minigame choice", {
      error,
    });

    await interaction
      .followUp({
        content: `Error: ${error.message}`,
        ephemeral: true,
      })
      .catch(() => {});
  }
}

// Helper function to handle dice duel accept button
async function handleDiceDuelAccept(interaction, customId) {
  try {
    // Extract duel ID from the custom ID
    const duelId = customId.replace("dice_duel_accept_", "");

    // Get the DiceDuelManager
    const {
      acceptDiceDuel,
      getActiveDuel,
    } = require("../utils/DiceDuelManager");

    // Get the duel
    const duel = getActiveDuel(duelId);
    if (!duel) {
      return await interaction.followUp({
        content: "❌ This duel no longer exists.",
        ephemeral: true,
      });
    }

    // Check if the user is the opponent
    if (interaction.user.id !== duel.opponentId) {
      return await interaction.followUp({
        content: "❌ Only the challenged player can accept this duel.",
        ephemeral: true,
      });
    }

    // Check if the duel is already accepted
    if (duel.isAccepted) {
      return await interaction.followUp({
        content: "❌ This duel has already been accepted.",
        ephemeral: true,
      });
    }

    // Accept the duel
    const result = await acceptDiceDuel(duelId, interaction.user.id);

    if (!result.success) {
      return await interaction.followUp({
        content: `❌ ${result.message}`,
        ephemeral: true,
      });
    }

    // Get the challenger
    const challenger = await interaction.client.users.fetch(duel.challengerId);

    // Update the message
    const { EmbedBuilder } = require("discord.js");
    const { formatAmount, EMOJIS } = require("../utils/embedcreator");

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle(`${EMOJIS.dice} Dice Duel Accepted`)
      .setDescription(
        `${interaction.user.toString()} has accepted ${challenger.toString()}'s dice duel challenge!`
      )
      .addFields(
        {
          name: "Bet Amount",
          value: `${formatAmount(
            BigInt(duel.amount)
          )} ${duel.currency.toUpperCase()}`,
          inline: true,
        },
        {
          name: "Next Step",
          value: "Both players must use `/diceduel-roll` to roll the dice.",
          inline: false,
        }
      )
      .setFooter({ text: `Duel ID: ${duelId}` })
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
      components: [],
    });

    // Log the acceptance
    logger.info(
      "DiceDuel",
      `User ${interaction.user.id} accepted dice duel ${duelId} from ${duel.challengerId}`,
      {
        amount: duel.amount,
        currency: duel.currency,
      }
    );
  } catch (error) {
    logger.error("DiceDuelHandler", "Error handling dice duel accept", {
      error,
    });

    try {
      await interaction.followUp({
        content: `❌ An error occurred: ${error.message}`,
        ephemeral: true,
      });
    } catch (replyError) {
      logger.error(
        "DiceDuelHandler",
        "Error replying to dice duel accept interaction",
        { error: replyError }
      );
    }
  }
}

// Helper function to handle dice duel decline button
async function handleDiceDuelDecline(interaction, customId) {
  try {
    // Extract duel ID from the custom ID
    const duelId = customId.replace("dice_duel_decline_", "");

    // Get the DiceDuelManager
    const {
      getActiveDuel,
      cancelDiceDuel,
    } = require("../utils/DiceDuelManager");

    // Get the duel
    const duel = getActiveDuel(duelId);
    if (!duel) {
      return await interaction.followUp({
        content: "❌ This duel no longer exists.",
        ephemeral: true,
      });
    }

    // Check if the user is the opponent
    if (interaction.user.id !== duel.opponentId) {
      return await interaction.followUp({
        content: "❌ Only the challenged player can decline this duel.",
        ephemeral: true,
      });
    }

    // Check if the duel is already accepted
    if (duel.isAccepted) {
      return await interaction.followUp({
        content:
          "❌ This duel has already been accepted and cannot be declined.",
        ephemeral: true,
      });
    }

    // Cancel the duel
    const result = await cancelDiceDuel(duel.challengerId);

    if (!result.success) {
      return await interaction.followUp({
        content: `❌ ${result.message}`,
        ephemeral: true,
      });
    }

    // Get the challenger
    const challenger = await interaction.client.users.fetch(duel.challengerId);

    // Update the message
    await interaction.editReply({
      content: `${interaction.user.toString()} has declined ${challenger.toString()}'s dice duel challenge. The bet has been refunded.`,
      embeds: [],
      components: [],
    });

    // Log the decline
    logger.info(
      "DiceDuel",
      `User ${interaction.user.id} declined dice duel ${duelId} from ${duel.challengerId}`,
      {
        amount: duel.amount,
        currency: duel.currency,
      }
    );
  } catch (error) {
    logger.error("DiceDuelHandler", "Error handling dice duel decline", {
      error,
    });

    try {
      await interaction.followUp({
        content: `❌ An error occurred: ${error.message}`,
        ephemeral: true,
      });
    } catch (replyError) {
      logger.error(
        "DiceDuelHandler",
        "Error replying to dice duel decline interaction",
        { error: replyError }
      );
    }
  }
}

// Handle closing betting for Hot/Cold game
async function handleCloseHotColdBetting(interaction, customId) {
  const hostId = customId.split(":")[1];

  // Check if user is the host
  if (interaction.user.id !== hostId) {
    return await interaction.followUp({
      content: "Only the host can close betting.",
      ephemeral: true,
    });
  }

  // Import HotColdManager
  const HotColdManager = require("../utils/HotColdManager");
  const { EmbedBuilder } = require("discord.js");
  const { EMOJIS } = require("../utils/embedcreator");

  try {
    // Close betting
    HotColdManager.closeBetting(hostId);

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(
        `${EMOJIS.fire || "🔥"} HOT COLD ${
          EMOJIS.snowflake || "❄️"
        } Betting Closed`
      )
      .setColor(0xff5733)
      .setDescription(
        `${interaction.user.toString()} has closed betting for their Hot/Cold game.`
      )
      .addFields({
        name: "Next Step",
        value: "Use `/hotcoldresult` to enter the result of your roll.",
        inline: false,
      })
      .setTimestamp();

    // Update message
    await interaction.editReply({
      embeds: [embed],
      components: [
        {
          type: 1, // Action Row
          components: [
            {
              type: 2, // Button
              style: 4, // Danger (red)
              label: "Cancel Game",
              custom_id: `hc_cancel_game:${hostId}`,
            },
          ],
        },
      ],
    });
  } catch (error) {
    logger.error("HotColdHandler", "Error closing betting", { error });

    await interaction.followUp({
      content: `Error: ${error.message}`,
      ephemeral: true,
    });
  }
}

// Handle cancelling Hot/Cold game
async function handleCancelHotColdGame(interaction, customId) {
  const hostId = customId.split(":")[1];

  // Check if user is the host
  if (interaction.user.id !== hostId) {
    return await interaction.followUp({
      content: "Only the host can cancel the game.",
      ephemeral: true,
    });
  }

  // Import HotColdManager
  const HotColdManager = require("../utils/HotColdManager");

  try {
    // Cancel game
    const result = await HotColdManager.cancelGame(hostId);

    // Update message
    await interaction.editReply({
      content: `Game cancelled. ${result.refunds.length} bets have been refunded.`,
      embeds: [],
      components: [],
    });
  } catch (error) {
    logger.error("HotColdHandler", "Error cancelling game", { error });

    await interaction.followUp({
      content: `Error: ${error.message}`,
      ephemeral: true,
    });
  }
}

// Helper function to format minigame name
function formatMinigameName(minigameType) {
  if (!minigameType) return "Unknown";

  if (minigameType.startsWith("hot_lucky_pick")) return "Hot Lucky Pick";
  if (minigameType.startsWith("cold_lucky_pick")) return "Cold Lucky Pick";
  if (minigameType === "rainbow_pick") return "Rainbow Pick";
  if (minigameType === "wildcard_four_same_color") return "Four Same Color";
  if (minigameType === "wildcard_one_black_white") return "Black/White Special";
  if (minigameType === "wildcard_two_black_white")
    return "Double Black/White Special";
  if (minigameType === "wildcard_all_colors") return "Sixshooter";
  return minigameType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}
