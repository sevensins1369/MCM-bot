// commands/hotcoldpot.js
// Command to view the pot for a Hot/Cold game

const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { formatAmount, EMOJIS } = require("../utils/embedcreator");
const {
  ValidationError,
  withErrorHandling,
} = require("../utils/error-handler");
const HotColdManager = require("../utils/HotColdManager");

module.exports = {
  // Slash command definition
  data: new SlashCommandBuilder()
    .setName("hotcoldpot")
    .setDescription("View the pot for a Hot/Cold game")
    .addUserOption((option) =>
      option
        .setName("host")
        .setDescription("The host of the Hot/Cold game")
        .setRequired(true)
    ),

  // Slash command execution
  execute: withErrorHandling(async function (interaction) {
    await interaction.deferReply();

    // Get options
    const host = interaction.options.getUser("host");

    // Get the game
    const game = HotColdManager.getActiveGame(host.id);
    if (!game) {
      throw new ValidationError(
        `${host.username} does not have an active Hot/Cold game.`
      );
    }

    // Calculate pot totals
    const osrsBets = game.bets.filter((b) => b.currency === "osrs");
    const rs3Bets = game.bets.filter((b) => b.currency === "rs3");

    let totalOsrs = 0n;
    let totalRs3 = 0n;

    for (const bet of osrsBets) {
      totalOsrs += BigInt(bet.amount || 0);
    }

    for (const bet of rs3Bets) {
      totalRs3 += BigInt(bet.amount || 0);
    }

    // Count bets by type
    const betCounts = {};
    for (const bet of game.bets) {
      betCounts[bet.betType] = (betCounts[bet.betType] || 0) + 1;
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(
        `${EMOJIS.fire || "🔥"} HOT COLD ${EMOJIS.snowflake || "❄️"} Game Pot`
      )
      .setColor(0xff5733)
      .setDescription(`Current pot for ${host.toString()}'s Hot/Cold game.`)
      .addFields(
        {
          name: "Status",
          value: game.isOpen ? "Open for Betting" : "Betting Closed",
          inline: true,
        },
        { name: "Game ID", value: game.id, inline: true },
        { name: "OSRS Pot", value: formatAmount(totalOsrs), inline: true },
        { name: "RS3 Pot", value: formatAmount(totalRs3), inline: true },
        { name: "Total Bets", value: game.bets.length.toString(), inline: true }
      )
      .setTimestamp();

    // Add bet breakdown if there are bets
    if (game.bets.length > 0) {
      // Add bet breakdown field
      let breakdownText = "";

      // First add hot/cold counts
      if (betCounts["hot"]) {
        breakdownText += `🔥 HOT: ${betCounts["hot"]}\n`;
      }
      if (betCounts["cold"]) {
        breakdownText += `❄️ COLD: ${betCounts["cold"]}\n`;
      }

      // Then add individual colors
      for (const color of HotColdManager.ALL_COLORS) {
        if (betCounts[color]) {
          breakdownText += `${
            color.charAt(0).toUpperCase() + color.slice(1)
          }: ${betCounts[color]}\n`;
        }
      }

      embed.addFields({
        name: "Bet Breakdown",
        value: breakdownText || "No bets",
      });
    }

    // Send embed
    await interaction.editReply({
      embeds: [embed],
    });
  }, "HotColdPotCommand"),

  // Prefix command execution
  async run(message, args) {
    try {
      // Check arguments
      if (args.length < 1) {
        throw new ValidationError("Usage: !hotcoldpot <host>");
      }

      // Get host ID
      const hostId = args[0].replace(/[<@!>]/g, "");

      // Find the host
      const host = await message.guild.members.fetch(hostId).catch(() => null);
      if (!host) {
        throw new ValidationError("Host not found.");
      }

      // Get the game
      const game = HotColdManager.getActiveGame(host.id);
      if (!game) {
        throw new ValidationError(
          `${host.user.username} does not have an active Hot/Cold game.`
        );
      }

      // Calculate pot totals
      const osrsBets = game.bets.filter((b) => b.currency === "osrs");
      const rs3Bets = game.bets.filter((b) => b.currency === "rs3");

      let totalOsrs = 0n;
      let totalRs3 = 0n;

      for (const bet of osrsBets) {
        totalOsrs += BigInt(bet.amount || 0);
      }

      for (const bet of rs3Bets) {
        totalRs3 += BigInt(bet.amount || 0);
      }

      // Count bets by type
      const betCounts = {};
      for (const bet of game.bets) {
        betCounts[bet.betType] = (betCounts[bet.betType] || 0) + 1;
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(
          `${EMOJIS.fire || "🔥"} HOT COLD ${EMOJIS.snowflake || "❄️"} Game Pot`
        )
        .setColor(0xff5733)
        .setDescription(
          `Current pot for ${host.user.toString()}'s Hot/Cold game.`
        )
        .addFields(
          {
            name: "Status",
            value: game.isOpen ? "Open for Betting" : "Betting Closed",
            inline: true,
          },
          { name: "Game ID", value: game.id, inline: true },
          { name: "OSRS Pot", value: formatAmount(totalOsrs), inline: true },
          { name: "RS3 Pot", value: formatAmount(totalRs3), inline: true },
          {
            name: "Total Bets",
            value: game.bets.length.toString(),
            inline: true,
          }
        )
        .setTimestamp();

      // Add bet breakdown if there are bets
      if (game.bets.length > 0) {
        // Add bet breakdown field
        let breakdownText = "";

        // First add hot/cold counts
        if (betCounts["hot"]) {
          breakdownText += `🔥 HOT: ${betCounts["hot"]}\n`;
        }
        if (betCounts["cold"]) {
          breakdownText += `❄️ COLD: ${betCounts["cold"]}\n`;
        }

        // Then add individual colors
        for (const color of HotColdManager.ALL_COLORS) {
          if (betCounts[color]) {
            breakdownText += `${
              color.charAt(0).toUpperCase() + color.slice(1)
            }: ${betCounts[color]}\n`;
          }
        }

        embed.addFields({
          name: "Bet Breakdown",
          value: breakdownText || "No bets",
        });
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
        console.error("Error in !hotcoldpot command:", error);
        await message.reply(
          "❌ An error occurred while retrieving the Hot/Cold pot."
        );
      }
    }
  },

  // Command aliases
  aliases: ["hcp"],
};
