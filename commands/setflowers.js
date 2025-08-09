// commands/setflowers.js
// Command to select flowers for a flower game with interactive buttons

const { SlashCommandBuilder } = require("@discordjs/builders");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const FlowerGameManager = require("../utils/FlowerGameManager");
const { EMOJIS } = require("../utils/embedcreator");
const {
  ValidationError,
  withErrorHandling,
} = require("../utils/error-handler");

// Flower emojis and colors for buttons
const FLOWER_BUTTONS = {
  red: { emoji: "🌹", style: ButtonStyle.Danger },
  orange: { emoji: "🧡", style: ButtonStyle.Danger },
  yellow: { emoji: "🌻", style: ButtonStyle.Primary },
  blue: { emoji: "🔵", style: ButtonStyle.Primary },
  purple: { emoji: "🟣", style: ButtonStyle.Secondary },
  pastel: { emoji: "🌸", style: ButtonStyle.Secondary },
  white: { emoji: "⚪", style: ButtonStyle.Secondary },
  black: { emoji: "⚫", style: ButtonStyle.Secondary },
  rainbow: { emoji: "🌈", style: ButtonStyle.Success },
};

module.exports = {
  // Slash command definition
  data: new SlashCommandBuilder()
    .setName("setflowers")
    .setDescription("Select flowers for your flower game")
    .addBooleanOption((option) =>
      option
        .setName("manual")
        .setDescription("Use manual text input instead of buttons")
        .setRequired(false)
    ),

  // Slash command execution
  execute: withErrorHandling(async function (interaction) {
    await interaction.deferReply();

    // Check if manual mode is requested
    const useManualMode = interaction.options.getBoolean("manual") || false;

    // Get the flower game
    const game = FlowerGameManager.getFlowerGame(interaction.user.id);
    if (!game) {
      throw new ValidationError("You do not have an active flower game.");
    }

    // Check if betting is closed
    if (game.isOpen) {
      throw new ValidationError(
        "You must close betting before selecting flowers."
      );
    }

    if (useManualMode) {
      // If manual mode, prompt for text input
      await interaction.editReply({
        content:
          "Please enter your flowers as a space-separated list using the `/setflowers-manual` command.\n" +
          "Example: `/setflowers-manual flowers:red blue yellow purple black rainbow white orange`",
        ephemeral: true,
      });
      return;
    }

    // Determine how many flowers are needed based on game type
    let requiredFlowers = 5;
    let instructionText = "Select 5 flowers for your game.";

    if (game.gameType === "rainbow_mania") {
      requiredFlowers = 8;
      instructionText = "Select 8 flowers for your Rainbow Mania game.";
    } else if (game.gameType === "flower_poker") {
      requiredFlowers = 10;
      instructionText =
        "Select 10 flowers for your Flower Poker game (first 5 for host, next 5 for player).";
    }

    // Create the flower selection embed
    const selectionEmbed = new EmbedBuilder()
      .setTitle(`${EMOJIS.cards} Select Flowers`)
      .setColor(0x4caf50)
      .setDescription(instructionText)
      .addFields(
        {
          name: "Game Type",
          value: formatGameType(game.gameType),
          inline: true,
        },
        { name: "Selected Flowers", value: "(None yet)", inline: true },
        { name: "Required", value: `${requiredFlowers} flowers`, inline: true }
      )
      .setFooter({ text: "Click the buttons below to select flowers" });

    // Create flower buttons (3 rows of 3 buttons)
    const flowerRows = createFlowerButtons();

    // Create control buttons (confirm, reset, cancel)
    const controlRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("sf_confirm")
        .setLabel("Confirm Selection")
        .setStyle(ButtonStyle.Success)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId("sf_reset")
        .setLabel("Reset Selection")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("sf_cancel")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
    );

    // Send the initial message with buttons
    const response = await interaction.editReply({
      embeds: [selectionEmbed],
      components: [...flowerRows, controlRow],
    });

    // Create collector for button interactions
    const selectedFlowers = [];

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000, // 5 minutes timeout
    });

    collector.on("collect", async (i) => {
      // Ensure only the command user can interact with buttons
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          content: "Only the host can select flowers.",
          ephemeral: true,
        });
        return;
      }

      // Handle button interactions
      if (i.customId === "sf_confirm") {
        if (selectedFlowers.length !== requiredFlowers) {
          await i.reply({
            content: `You need to select exactly ${requiredFlowers} flowers.`,
            ephemeral: true,
          });
          return;
        }

        // Process the selected flowers
        await processSelectedFlowers(i, game, selectedFlowers);
        collector.stop("confirmed");
        return;
      } else if (i.customId === "sf_reset") {
        // Reset selection
        selectedFlowers.length = 0;

        // Update embed
        selectionEmbed.spliceFields(1, 1, {
          name: "Selected Flowers",
          value: "(None yet)",
          inline: true,
        });

        // Disable confirm button
        const newComponents = response.components.map((row) => {
          const newRow = ActionRowBuilder.from(row);
          const confirmButton = newRow.components.find(
            (c) => c.data.custom_id === "sf_confirm"
          );
          if (confirmButton) confirmButton.setDisabled(true);
          return newRow;
        });

        await i.update({ embeds: [selectionEmbed], components: newComponents });
        return;
      } else if (i.customId === "sf_cancel") {
        // Cancel selection
        await i.update({
          content: "Flower selection cancelled.",
          embeds: [],
          components: [],
        });
        collector.stop("cancelled");
        return;
      }

      // Handle flower button clicks
      const flowerType = i.customId.replace("sf_flower_", "");

      // Add flower to selection if not at limit
      if (selectedFlowers.length < requiredFlowers) {
        selectedFlowers.push(flowerType);

        // Update embed with selected flowers
        const flowerEmojis = selectedFlowers
          .map((f) => `${FLOWER_BUTTONS[f].emoji} ${f}`)
          .join(", ");
        selectionEmbed.spliceFields(1, 1, {
          name: "Selected Flowers",
          value: flowerEmojis,
          inline: true,
        });

        // Enable confirm button if we have enough flowers
        const newComponents = response.components.map((row) => {
          const newRow = ActionRowBuilder.from(row);
          const confirmButton = newRow.components.find(
            (c) => c.data.custom_id === "sf_confirm"
          );
          if (confirmButton) {
            confirmButton.setDisabled(
              selectedFlowers.length !== requiredFlowers
            );
          }
          return newRow;
        });

        await i.update({ embeds: [selectionEmbed], components: newComponents });
      } else {
        await i.reply({
          content: `You've already selected ${requiredFlowers} flowers. Click "Confirm Selection" or "Reset Selection".`,
          ephemeral: true,
        });
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time") {
        // Timeout
        await interaction.followUp({
          content: "Flower selection timed out.",
          ephemeral: true,
        });
      }
    });
  }, "SetFlowersCommand"),

  // Prefix command execution
  async run(message, args) {
    try {
      // For prefix command, we'll direct users to use the slash command for the interactive version
      await message.reply(
        "To use the interactive flower selector, please use the slash command `/setflowers`.\n" +
          "If you prefer manual input, use `/setflowers manual:true` or continue using the text-based command:\n" +
          "`!setflowers-manual red blue yellow purple black rainbow white orange`"
      );
    } catch (error) {
      // Handle errors for prefix command
      if (error instanceof ValidationError) {
        await message.reply(`⚠️ ${error.message}`);
      } else {
        console.error("Error in !setflowers command:", error);
        await message.reply("❌ An error occurred while setting flowers.");
      }
    }
  },

  // Command aliases
  aliases: ["sf"],
};

/**
 * Create flower button rows
 * @returns {Array} Array of ActionRowBuilder objects with flower buttons
 */
function createFlowerButtons() {
  const rows = [];
  const flowerTypes = Object.keys(FLOWER_BUTTONS);

  // Create rows with 3 buttons each
  for (let i = 0; i < flowerTypes.length; i += 3) {
    const row = new ActionRowBuilder();

    for (let j = 0; j < 3 && i + j < flowerTypes.length; j++) {
      const flowerType = flowerTypes[i + j];
      const { emoji, style } = FLOWER_BUTTONS[flowerType];

      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`sf_flower_${flowerType}`)
          .setLabel(flowerType)
          .setEmoji(emoji)
          .setStyle(style)
      );
    }

    rows.push(row);
  }

  return rows;
}

/**
 * Process the selected flowers and update the game
 * @param {ButtonInteraction} interaction - The button interaction
 * @param {Object} game - The flower game
 * @param {Array} selectedFlowers - Array of selected flower types
 */
async function processSelectedFlowers(interaction, game, selectedFlowers) {
  try {
    // Convert array to space-separated string
    const flowersStr = selectedFlowers.join(" ");

    // Handle Flower Poker specific options
    let options = {};
    if (game.gameType === "flower_poker") {
      const hostHand = selectedFlowers.slice(0, 5);
      const playerHand = selectedFlowers.slice(5, 10);
      options = { hostHand, playerHand };
    }

    // Select flowers
    const flowers = await FlowerGameManager.selectFlowers(
      interaction.user.id,
      flowersStr,
      options
    );

    // Create result embed
    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS.cards} Flowers Selected`)
      .setColor(0x4caf50)
      .setDescription(`You selected the following flowers for your game:`)
      .addFields({
        name: "Flowers",
        value: flowers
          .map(
            (f) =>
              `${FLOWER_BUTTONS[f].emoji} ${
                f.charAt(0).toUpperCase() + f.slice(1)
              }`
          )
          .join(", "),
      })
      .setTimestamp()
      .setFooter({ text: "Flower Game" });

    // Add game-specific information
    if (game.gameType === "hot_cold") {
      // Add flower counts
      const hotCount = flowers.filter((f) =>
        FlowerGameManager.FLOWERS.HOT.includes(f)
      ).length;
      const coldCount = flowers.filter((f) =>
        FlowerGameManager.FLOWERS.COLD.includes(f)
      ).length;
      const specialCount = flowers.filter((f) =>
        FlowerGameManager.FLOWERS.SPECIAL.includes(f)
      ).length;

      embed.addFields(
        { name: "Hot Flowers", value: hotCount.toString(), inline: true },
        { name: "Cold Flowers", value: coldCount.toString(), inline: true },
        {
          name: "Special Flowers",
          value: specialCount.toString(),
          inline: true,
        }
      );
    } else if (game.gameType === "flower_poker") {
      // Add poker hands
      const hostHand = game.hostHand || flowers.slice(0, 5);
      const playerHand = game.playerHand || flowers.slice(5, 10);

      const hostHandRank = FlowerGameManager.evaluatePokerHand(hostHand);
      const playerHandRank = FlowerGameManager.evaluatePokerHand(playerHand);

      embed.addFields(
        {
          name: "Host Hand",
          value: hostHand
            .map(
              (f) =>
                `${FLOWER_BUTTONS[f].emoji} ${
                  f.charAt(0).toUpperCase() + f.slice(1)
                }`
            )
            .join(", "),
          inline: false,
        },
        {
          name: "Host Hand Rank",
          value: getPokerHandName(hostHandRank.rank),
          inline: true,
        },
        {
          name: "Player Hand",
          value: playerHand
            .map(
              (f) =>
                `${FLOWER_BUTTONS[f].emoji} ${
                  f.charAt(0).toUpperCase() + f.slice(1)
                }`
            )
            .join(", "),
          inline: false,
        },
        {
          name: "Player Hand Rank",
          value: getPokerHandName(playerHandRank.rank),
          inline: true,
        }
      );
    } else if (game.gameType === "rainbow_mania") {
      // Add flower counts
      const hotCount = flowers.filter((f) =>
        FlowerGameManager.FLOWERS.HOT.includes(f)
      ).length;
      const coldCount = flowers.filter((f) =>
        FlowerGameManager.FLOWERS.COLD.includes(f)
      ).length;
      const rainbowCount = flowers.filter((f) => f === "rainbow").length;
      const blackCount = flowers.filter((f) => f === "black").length;
      const whiteCount = flowers.filter((f) => f === "white").length;

      embed.addFields(
        { name: "Hot Flowers", value: hotCount.toString(), inline: true },
        { name: "Cold Flowers", value: coldCount.toString(), inline: true },
        {
          name: "Rainbow Flowers",
          value: rainbowCount.toString(),
          inline: true,
        },
        { name: "Black Flowers", value: blackCount.toString(), inline: true },
        { name: "White Flowers", value: whiteCount.toString(), inline: true }
      );

      // Check if any minigames were triggered
      const minigameCheck = FlowerGameManager.checkRainbowManiaMinigames(
        interaction.user.id
      );
      if (
        minigameCheck &&
        minigameCheck.minigames &&
        minigameCheck.minigames.length > 0
      ) {
        embed.addFields({
          name: "🎮 Minigame Triggered!",
          value: `A special minigame has been triggered: ${formatMinigameName(
            minigameCheck.currentMinigame.type
          )}`,
          inline: false,
        });
      }
    }

    // Add buttons for processing payouts or cancelling
    const components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`process_payouts:${interaction.user.id}`)
          .setLabel("Process Payouts")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cancel_game:${interaction.user.id}`)
          .setLabel("Cancel Game")
          .setStyle(ButtonStyle.Danger)
      ),
    ];

    // Update the message
    await interaction.update({
      embeds: [embed],
      components,
    });

    // If a minigame was triggered, send it as a follow-up
    const minigameCheck = FlowerGameManager.checkRainbowManiaMinigames(
      interaction.user.id
    );
    if (
      game.gameType === "rainbow_mania" &&
      minigameCheck &&
      minigameCheck.minigames &&
      minigameCheck.minigames.length > 0
    ) {
      // Create minigame embed
      const minigameEmbed = FlowerGameManager.createMinigameEmbed(
        game,
        interaction.user,
        minigameCheck.currentMinigame
      );

      // Send minigame embed as a follow-up
      await interaction.followUp({
        embeds: [minigameEmbed],
        components: FlowerGameManager.createMinigameButtons(
          minigameCheck.currentMinigame.type
        ),
      });
    }
  } catch (error) {
    console.error("Error processing selected flowers:", error);
    await interaction.update({
      content: `Error: ${error.message}`,
      embeds: [],
      components: [],
    });
  }
}

// Helper function to get poker hand name
function getPokerHandName(rank) {
  switch (rank) {
    case 7:
      return "Five of a Kind";
    case 6:
      return "Four of a Kind";
    case 5:
      return "Full House";
    case 3:
      return "Three of a Kind";
    case 2:
      return "Two Pair";
    case 1:
      return "One Pair";
    case 0:
      return "High Card";
    default:
      return "Unknown";
  }
}

// Helper function to format minigame name
function formatMinigameName(minigameType) {
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
