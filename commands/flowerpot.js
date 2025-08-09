// commands/flowerpot.js
// Command to view the pot for a flower game

const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { getFlowerGame } = require("../utils/FlowerGameManager");
const { EMOJIS, formatAmount } = require("../utils/embedcreator");
const {
  ValidationError,
  withErrorHandling,
} = require("../utils/error-handler");

module.exports = {
  // Slash command definition
  data: new SlashCommandBuilder()
    .setName("flowerpot")
    .setDescription("View the pot for a flower game")
    .addUserOption((option) =>
      option
        .setName("host")
        .setDescription("The host of the flower game")
        .setRequired(true)
    ),

  // Slash command execution
  execute: withErrorHandling(async function (interaction) {
    await interaction.deferReply();

    // Get options
    const hostId = interaction.options.getUser("host").id;

    // Find the host
    const host = await interaction.guild.members
      .fetch(hostId)
      .catch(() => null);
    if (!host) {
      throw new ValidationError("Host not found.");
    }

    // Get the flower game
    const game = getFlowerGame(hostId);
    if (!game) {
      throw new ValidationError(
        `${host.user.username} does not have an active flower game.`
      );
    }

    // Calculate pot totals - FIX: Use BigInt for calculations
    const osrsBets = game.bets.filter((b) => b.currency === "osrs");
    const rs3Bets = game.bets.filter((b) => b.currency === "rs3");

    let totalOsrs = 0n;
    let totalRs3 = 0n;

    for (const bet of osrsBets) {
      totalOsrs += BigInt(bet.amount);
    }

    for (const bet of rs3Bets) {
      totalRs3 += BigInt(bet.amount);
    }

    // Format game type for display
    const gameTypeDisplay = formatGameType(game.gameType);

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS.cards} ${gameTypeDisplay} Game Pot`)
      .setColor(0x4caf50)
      .setDescription(`Current pot for ${host.user.username}'s flower game.`)
      .addFields(
        { name: "Game Type", value: gameTypeDisplay, inline: true },
        {
          name: "Status",
          value: game.isOpen ? "Open for Betting" : "Betting Closed",
          inline: true,
        },
        { name: "OSRS Pot", value: formatAmount(totalOsrs), inline: true },
        { name: "RS3 Pot", value: formatAmount(totalRs3), inline: true },
        { name: "Total Bets", value: game.bets.length.toString(), inline: true }
      )
      .setTimestamp()
      .setFooter({ text: "Flower Game Pot" });

    // Add bet breakdown if there are bets
    if (game.bets.length > 0) {
      // Count bets by type
      const betCounts = {};
      for (const bet of game.bets) {
        betCounts[bet.betType] = (betCounts[bet.betType] || 0) + 1;
      }

      // Add bet breakdown field
      let breakdownText = "";
      for (const [type, count] of Object.entries(betCounts)) {
        breakdownText += `${
          type.charAt(0).toUpperCase() + type.slice(1)
        }: ${count}\n`;
      }

      embed.addFields({ name: "Bet Breakdown", value: breakdownText });
    }

    // Add game-specific information
    if (game.gameType === "flower_poker") {
      if (game.hostHand && game.hostHand.length > 0) {
        const FlowerGameManager = require("../utils/FlowerGameManager");
        const hostHandRank = FlowerGameManager.evaluatePokerHand(game.hostHand);
        const playerHandRank = FlowerGameManager.evaluatePokerHand(
          game.playerHand
        );

        embed.addFields(
          {
            name: "Host Hand",
            value: game.hostHand
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
            value: game.playerHand
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
      } else {
        embed.addFields({
          name: "Game Rules",
          value:
            "Compare 5 flowers for host vs players. Pairs, three of a kind, full house, four of a kind, and five of a kind determine the winner.",
        });
      }
    } else if (game.gameType === "rainbow_mania") {
      if (game.selectedFlowers && game.selectedFlowers.length > 0) {
        const FlowerGameManager = require("../utils/FlowerGameManager");
        const hotCount = game.selectedFlowers.filter((f) =>
          FlowerGameManager.FLOWERS.HOT.includes(f)
        ).length;
        const coldCount = game.selectedFlowers.filter((f) =>
          FlowerGameManager.FLOWERS.COLD.includes(f)
        ).length;
        const rainbowCount = game.selectedFlowers.filter(
          (f) => f === "rainbow"
        ).length;
        const blackCount = game.selectedFlowers.filter(
          (f) => f === "black"
        ).length;
        const whiteCount = game.selectedFlowers.filter(
          (f) => f === "white"
        ).length;

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

        if (game.minigameActive) {
          embed.addFields({
            name: "🎮 Active Minigame",
            value: formatMinigameName(game.currentMinigame),
            inline: false,
          });
        }
      } else {
        embed.addFields({
          name: "Game Rules",
          value:
            "Bet on hot, cold, rainbow, or wildcard. Special combinations trigger bonus minigames with multipliers!",
        });
      }
    }

    // Send embed
    await interaction.editReply({
      embeds: [embed],
    });
  }, "FlowerPotCommand"),

  // Prefix command execution
  async run(message, args) {
    try {
      // Check arguments
      if (args.length < 1) {
        throw new ValidationError("Usage: !flowerpot <host>");
      }

      // Get host ID
      const hostId = args[0].replace(/[<@!>]/g, "");

      // Find the host
      const host = await message.guild.members.fetch(hostId).catch(() => null);
      if (!host) {
        throw new ValidationError("Host not found.");
      }

      // Get the flower game
      const game = getFlowerGame(hostId);
      if (!game) {
        throw new ValidationError(
          `${host.user.username} does not have an active flower game.`
        );
      }

      // Calculate pot totals - FIX: Use BigInt for calculations
      const osrsBets = game.bets.filter((b) => b.currency === "osrs");
      const rs3Bets = game.bets.filter((b) => b.currency === "rs3");

      let totalOsrs = 0n;
      let totalRs3 = 0n;

      for (const bet of osrsBets) {
        totalOsrs += BigInt(bet.amount);
      }

      for (const bet of rs3Bets) {
        totalRs3 += BigInt(bet.amount);
      }

      // Format game type for display
      const gameTypeDisplay = formatGameType(game.gameType);

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`${EMOJIS.cards} ${gameTypeDisplay} Game Pot`)
        .setColor(0x4caf50)
        .setDescription(`Current pot for ${host.user.username}'s flower game.`)
        .addFields(
          { name: "Game Type", value: gameTypeDisplay, inline: true },
          {
            name: "Status",
            value: game.isOpen ? "Open for Betting" : "Betting Closed",
            inline: true,
          },
          { name: "OSRS Pot", value: formatAmount(totalOsrs), inline: true },
          { name: "RS3 Pot", value: formatAmount(totalRs3), inline: true },
          {
            name: "Total Bets",
            value: game.bets.length.toString(),
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({ text: "Flower Game Pot" });

      // Add bet breakdown if there are bets
      if (game.bets.length > 0) {
        // Count bets by type
        const betCounts = {};
        for (const bet of game.bets) {
          betCounts[bet.betType] = (betCounts[bet.betType] || 0) + 1;
        }

        // Add bet breakdown field
        let breakdownText = "";
        for (const [type, count] of Object.entries(betCounts)) {
          breakdownText += `${
            type.charAt(0).toUpperCase() + type.slice(1)
          }: ${count}\n`;
        }

        embed.addFields({ name: "Bet Breakdown", value: breakdownText });
      }

      // Add game-specific information
      if (game.gameType === "flower_poker") {
        if (game.hostHand && game.hostHand.length > 0) {
          const FlowerGameManager = require("../utils/FlowerGameManager");
          const hostHandRank = FlowerGameManager.evaluatePokerHand(
            game.hostHand
          );
          const playerHandRank = FlowerGameManager.evaluatePokerHand(
            game.playerHand
          );

          embed.addFields(
            {
              name: "Host Hand",
              value: game.hostHand
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
              value: game.playerHand
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
        } else {
          embed.addFields({
            name: "Game Rules",
            value:
              "Compare 5 flowers for host vs players. Pairs, three of a kind, full house, four of a kind, and five of a kind determine the winner.",
          });
        }
      } else if (game.gameType === "rainbow_mania") {
        if (game.selectedFlowers && game.selectedFlowers.length > 0) {
          const FlowerGameManager = require("../utils/FlowerGameManager");
          const hotCount = game.selectedFlowers.filter((f) =>
            FlowerGameManager.FLOWERS.HOT.includes(f)
          ).length;
          const coldCount = game.selectedFlowers.filter((f) =>
            FlowerGameManager.FLOWERS.COLD.includes(f)
          ).length;
          const rainbowCount = game.selectedFlowers.filter(
            (f) => f === "rainbow"
          ).length;
          const blackCount = game.selectedFlowers.filter(
            (f) => f === "black"
          ).length;
          const whiteCount = game.selectedFlowers.filter(
            (f) => f === "white"
          ).length;

          embed.addFields(
            { name: "Hot Flowers", value: hotCount.toString(), inline: true },
            { name: "Cold Flowers", value: coldCount.toString(), inline: true },
            {
              name: "Rainbow Flowers",
              value: rainbowCount.toString(),
              inline: true,
            },
            {
              name: "Black Flowers",
              value: blackCount.toString(),
              inline: true,
            },
            {
              name: "White Flowers",
              value: whiteCount.toString(),
              inline: true,
            }
          );

          if (game.minigameActive) {
            embed.addFields({
              name: "🎮 Active Minigame",
              value: formatMinigameName(game.currentMinigame),
              inline: false,
            });
          }
        } else {
          embed.addFields({
            name: "Game Rules",
            value:
              "Bet on hot, cold, rainbow, or wildcard. Special combinations trigger bonus minigames with multipliers!",
          });
        }
      }

      // Send embed
      await message.reply({
        embeds: [embed],
      });
    } catch (error) {
      // Handle errors for prefix command
      if (error instanceof ValidationError) {
        await message.reply(`⚠️ ${error.message}`);
      } else {
        console.error("Error in !flowerpot command:", error);
        await message.reply(
          "❌ An error occurred while retrieving the flower pot."
        );
      }
    }
  },

  // Command aliases
  aliases: ["fp"],
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
