// commands/setflowers-manual.js
// Command to manually select flowers for a flower game

const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const FlowerGameManager = require("../utils/FlowerGameManager");
const { EMOJIS } = require("../utils/embedcreator");
const {
  ValidationError,
  withErrorHandling,
} = require("../utils/error-handler");

module.exports = {
  // Slash command definition
  data: new SlashCommandBuilder()
    .setName("setflowers-manual")
    .setDescription("Manually select flowers for your flower game")
    .addStringOption((option) =>
      option
        .setName("flowers")
        .setDescription(
          "Space-separated list of flowers (red, orange, yellow, blue, purple, white, black, rainbow, pastel)"
        )
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("host_hand")
        .setDescription(
          "For Flower Poker: 5 flowers for host hand (space-separated)"
        )
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("player_hand")
        .setDescription(
          "For Flower Poker: 5 flowers for player hand (space-separated)"
        )
        .setRequired(false)
    ),

  // Slash command execution
  execute: withErrorHandling(async function (interaction) {
    await interaction.deferReply();

    // Get options
    const flowersStr = interaction.options.getString("flowers");
    const hostHandStr = interaction.options.getString("host_hand");
    const playerHandStr = interaction.options.getString("player_hand");

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

    // Handle Flower Poker specific options
    let options = {};
    if (game.gameType === "flower_poker") {
      if (hostHandStr && playerHandStr) {
        const hostHand = hostHandStr
          .toLowerCase()
          .split(/\s+/)
          .filter((f) => FlowerGameManager.FLOWERS.ALL.includes(f));
        const playerHand = playerHandStr
          .toLowerCase()
          .split(/\s+/)
          .filter((f) => FlowerGameManager.FLOWERS.ALL.includes(f));

        if (hostHand.length !== 5) {
          throw new ValidationError(
            "Host hand must contain exactly 5 valid flowers."
          );
        }

        if (playerHand.length !== 5) {
          throw new ValidationError(
            "Player hand must contain exactly 5 valid flowers."
          );
        }

        options = { hostHand, playerHand };
      }
    } else if (game.gameType === "rainbow_mania") {
      // Validate for Rainbow Mania (needs exactly 8 flowers)
      const flowers = flowersStr
        .toLowerCase()
        .split(/\s+/)
        .filter((f) => FlowerGameManager.FLOWERS.ALL.includes(f));
      if (flowers.length !== 8) {
        throw new ValidationError("Rainbow Mania requires exactly 8 flowers.");
      }
    }

    // Select flowers
    const selectedFlowers = await FlowerGameManager.selectFlowers(
      interaction.user.id,
      flowersStr,
      options
    );

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS.cards} Flowers Selected`)
      .setColor(0x4caf50)
      .setDescription(`You selected the following flowers for your game:`)
      .addFields({
        name: "Flowers",
        value: selectedFlowers
          .map((f) => f.charAt(0).toUpperCase() + f.slice(1))
          .join(", "),
      })
      .setTimestamp()
      .setFooter({ text: "Flower Game" });

    // Add game-specific information
    if (game.gameType === "hot_cold") {
      // Add flower counts
      const hotCount = selectedFlowers.filter((f) =>
        FlowerGameManager.FLOWERS.HOT.includes(f)
      ).length;
      const coldCount = selectedFlowers.filter((f) =>
        FlowerGameManager.FLOWERS.COLD.includes(f)
      ).length;
      const specialCount = selectedFlowers.filter((f) =>
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
      const hostHand = game.hostHand || selectedFlowers.slice(0, 5);
      const playerHand = game.playerHand || selectedFlowers.slice(5, 10);

      const hostHandRank = FlowerGameManager.evaluatePokerHand(hostHand);
      const playerHandRank = FlowerGameManager.evaluatePokerHand(playerHand);

      embed.addFields(
        {
          name: "Host Hand",
          value: hostHand
            .map((f) => f.charAt(0).toUpperCase() + f.slice(1))
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
            .map((f) => f.charAt(0).toUpperCase() + f.slice(1))
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
      const hotCount = selectedFlowers.filter((f) =>
        FlowerGameManager.FLOWERS.HOT.includes(f)
      ).length;
      const coldCount = selectedFlowers.filter((f) =>
        FlowerGameManager.FLOWERS.COLD.includes(f)
      ).length;
      const rainbowCount = selectedFlowers.filter(
        (f) => f === "rainbow"
      ).length;
      const blackCount = selectedFlowers.filter((f) => f === "black").length;
      const whiteCount = selectedFlowers.filter((f) => f === "white").length;

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
    }

    // Add buttons for processing payouts or cancelling
    const components = [
      {
        type: 1, // Action Row
        components: [
          {
            type: 2, // Button
            style: 3, // Success (green)
            label: "Process Payouts",
            custom_id: `process_payouts:${interaction.user.id}`,
          },
          {
            type: 2, // Button
            style: 4, // Danger (red)
            label: "Cancel Game",
            custom_id: `cancel_game:${interaction.user.id}`,
          },
        ],
      },
    ];

    // Send embed
    await interaction.editReply({
      embeds: [embed],
      components,
    });
  }, "SetFlowersManualCommand"),

  // Prefix command execution
  async run(message, args) {
    try {
      // Check arguments
      if (args.length < 1) {
        throw new ValidationError(
          "Usage: !setflowers-manual <flowers> [host_hand] [player_hand]"
        );
      }

      // Get flowers string
      const flowersStr = args.join(" ");

      // Check for Flower Poker hands
      let hostHandStr = null;
      let playerHandStr = null;

      // Look for special format: !setflowers host:red blue yellow green black player:white purple orange yellow black
      const fullCommand = message.content;
      const hostHandMatch = fullCommand.match(/host:([^player]+)/i);
      const playerHandMatch = fullCommand.match(/player:([^\s]+.*)/i);

      if (hostHandMatch && playerHandMatch) {
        hostHandStr = hostHandMatch[1].trim();
        playerHandStr = playerHandMatch[1].trim();
      }

      // Get the flower game
      const game = FlowerGameManager.getFlowerGame(message.author.id);
      if (!game) {
        throw new ValidationError("You do not have an active flower game.");
      }

      // Check if betting is closed
      if (game.isOpen) {
        throw new ValidationError(
          "You must close betting before selecting flowers."
        );
      }

      // Handle Flower Poker specific options
      let options = {};
      if (game.gameType === "flower_poker") {
        if (hostHandStr && playerHandStr) {
          const hostHand = hostHandStr
            .toLowerCase()
            .split(/\s+/)
            .filter((f) => FlowerGameManager.FLOWERS.ALL.includes(f));
          const playerHand = playerHandStr
            .toLowerCase()
            .split(/\s+/)
            .filter((f) => FlowerGameManager.FLOWERS.ALL.includes(f));

          if (hostHand.length !== 5) {
            throw new ValidationError(
              "Host hand must contain exactly 5 valid flowers."
            );
          }

          if (playerHand.length !== 5) {
            throw new ValidationError(
              "Player hand must contain exactly 5 valid flowers."
            );
          }

          options = { hostHand, playerHand };
        }
      } else if (game.gameType === "rainbow_mania") {
        // Validate for Rainbow Mania (needs exactly 8 flowers)
        const flowers = flowersStr
          .toLowerCase()
          .split(/\s+/)
          .filter((f) => FlowerGameManager.FLOWERS.ALL.includes(f));
        if (flowers.length !== 8) {
          throw new ValidationError(
            "Rainbow Mania requires exactly 8 flowers."
          );
        }
      }

      // Select flowers
      const selectedFlowers = await FlowerGameManager.selectFlowers(
        message.author.id,
        flowersStr,
        options
      );

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`${EMOJIS.cards} Flowers Selected`)
        .setColor(0x4caf50)
        .setDescription(`You selected the following flowers for your game:`)
        .addFields({
          name: "Flowers",
          value: selectedFlowers
            .map((f) => f.charAt(0).toUpperCase() + f.slice(1))
            .join(", "),
        })
        .setTimestamp()
        .setFooter({ text: "Flower Game" });

      // Add game-specific information
      if (game.gameType === "hot_cold") {
        // Add flower counts
        const hotCount = selectedFlowers.filter((f) =>
          FlowerGameManager.FLOWERS.HOT.includes(f)
        ).length;
        const coldCount = selectedFlowers.filter((f) =>
          FlowerGameManager.FLOWERS.COLD.includes(f)
        ).length;
        const specialCount = selectedFlowers.filter((f) =>
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
        const hostHand = game.hostHand || selectedFlowers.slice(0, 5);
        const playerHand = game.playerHand || selectedFlowers.slice(5, 10);

        const hostHandRank = FlowerGameManager.evaluatePokerHand(hostHand);
        const playerHandRank = FlowerGameManager.evaluatePokerHand(playerHand);

        embed.addFields(
          {
            name: "Host Hand",
            value: hostHand
              .map((f) => f.charAt(0).toUpperCase() + f.slice(1))
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
              .map((f) => f.charAt(0).toUpperCase() + f.slice(1))
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
        const hotCount = selectedFlowers.filter((f) =>
          FlowerGameManager.FLOWERS.HOT.includes(f)
        ).length;
        const coldCount = selectedFlowers.filter((f) =>
          FlowerGameManager.FLOWERS.COLD.includes(f)
        ).length;
        const rainbowCount = selectedFlowers.filter(
          (f) => f === "rainbow"
        ).length;
        const blackCount = selectedFlowers.filter((f) => f === "black").length;
        const whiteCount = selectedFlowers.filter((f) => f === "white").length;

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
          message.author.id
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

          // Create minigame embed
          const minigameEmbed = FlowerGameManager.createMinigameEmbed(
            game,
            message.author,
            minigameCheck.currentMinigame
          );

          // Send minigame embed as a follow-up
          await message.channel.send({
            embeds: [minigameEmbed],
            components: FlowerGameManager.createMinigameButtons(
              minigameCheck.currentMinigame.type
            ),
          });
        }
      }

      // Add buttons for processing payouts or cancelling
      const components = [
        {
          type: 1, // Action Row
          components: [
            {
              type: 2, // Button
              style: 3, // Success (green)
              label: "Process Payouts",
              custom_id: `process_payouts:${message.author.id}`,
            },
            {
              type: 2, // Button
              style: 4, // Danger (red)
              label: "Cancel Game",
              custom_id: `cancel_game:${message.author.id}`,
            },
          ],
        },
      ];

      // Send embed
      await message.reply({
        embeds: [embed],
        components,
      });
    } catch (error) {
      // Handle errors for prefix command
      if (error instanceof ValidationError) {
        await message.reply(`⚠️ ${error.message}`);
      } else {
        console.error("Error in !setflowers-manual command:", error);
        await message.reply("❌ An error occurred while setting flowers.");
      }
    }
  },

  // Command aliases
  aliases: ["sfm"],
};

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
