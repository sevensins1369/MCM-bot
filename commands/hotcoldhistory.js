// commands/hotcoldhistory.js
// Command to view history of Hot/Cold games

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
    .setName("hotcoldhistory")
    .setDescription("View your Hot/Cold game history")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to view history for (defaults to yourself)")
        .setRequired(false)
    ),

  // Slash command execution
  execute: withErrorHandling(async function (interaction) {
    await interaction.deferReply();

    // Get options
    const user = interaction.options.getUser("user") || interaction.user;

    // Get history
    const history = await HotColdManager.getHistory(user.id);

    // Check if history exists, but don't throw an error if it doesn't
    if (history.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle(
          `${EMOJIS.fire || "🔥"} HOT COLD ${EMOJIS.snowflake || "❄️"} History`
        )
        .setColor(0xff5733)
        .setDescription(
          `${
            user.id === interaction.user.id
              ? "You have"
              : `${user.username} has`
          } no Hot/Cold game history.`
        )
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed],
      });
      return;
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(
        `${EMOJIS.fire || "🔥"} HOT COLD ${EMOJIS.snowflake || "❄️"} History`
      )
      .setColor(0xff5733)
      .setDescription(`Hot/Cold game history for ${user.toString()}`)
      .setTimestamp();

    // Add history fields (most recent 15 games)
    const recentGames = history.slice(0, 15);

    // Count hot and cold results
    let hotCount = 0;
    let coldCount = 0;

    // Create history text
    let historyText = "";
    for (let i = 0; i < recentGames.length; i++) {
      const game = recentGames[i];
      const isHot = game.result && game.result.type === "hot";

      if (isHot) hotCount++;
      else coldCount++;

      const colorName = game.result
        ? game.result.color.toUpperCase()
        : "UNKNOWN";
      const date = game.endedAt
        ? new Date(game.endedAt).toLocaleDateString()
        : "N/A";

      historyText += `${i + 1}. ${
        isHot ? "🔥" : "❄️"
      } ${colorName} (${date})\n`;
    }

    embed.addFields(
      {
        name: "Last 15 Games",
        value: historyText || "No games found",
        inline: false,
      },
      { name: "Hot Results", value: hotCount.toString(), inline: true },
      { name: "Cold Results", value: coldCount.toString(), inline: true },
      { name: "Total Games", value: history.length.toString(), inline: true }
    );

    // Send embed
    await interaction.editReply({
      embeds: [embed],
    });
  }, "HotColdHistoryCommand"),

  // Prefix command execution
  async run(message, args) {
    try {
      // Get user
      let userId = message.author.id;
      let user = message.author;

      if (args.length > 0) {
        const mentionedUser = message.mentions.users.first();
        if (mentionedUser) {
          userId = mentionedUser.id;
          user = mentionedUser;
        } else {
          // Try to fetch by ID
          try {
            const fetchedUser = await message.client.users.fetch(
              args[0].replace(/[<@!>]/g, "")
            );
            if (fetchedUser) {
              userId = fetchedUser.id;
              user = fetchedUser;
            }
          } catch (error) {
            // Ignore fetch errors
          }
        }
      }

      // Get history
      const history = await HotColdManager.getHistory(userId);

      // Check if history exists, but don't throw an error if it doesn't
      if (history.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle(
            `${EMOJIS.fire || "🔥"} HOT COLD ${
              EMOJIS.snowflake || "❄️"
            } History`
          )
          .setColor(0xff5733)
          .setDescription(
            `${
              userId === message.author.id ? "You have" : `${user.username} has`
            } no Hot/Cold game history.`
          )
          .setTimestamp();

        await message.reply({
          embeds: [embed],
        });
        return;
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(
          `${EMOJIS.fire || "🔥"} HOT COLD ${EMOJIS.snowflake || "❄️"} History`
        )
        .setColor(0xff5733)
        .setDescription(`Hot/Cold game history for ${user.toString()}`)
        .setTimestamp();

      // Add history fields (most recent 15 games)
      const recentGames = history.slice(0, 15);

      // Count hot and cold results
      let hotCount = 0;
      let coldCount = 0;

      // Create history text
      let historyText = "";
      for (let i = 0; i < recentGames.length; i++) {
        const game = recentGames[i];
        const isHot = game.result && game.result.type === "hot";

        if (isHot) hotCount++;
        else coldCount++;

        const colorName = game.result
          ? game.result.color.toUpperCase()
          : "UNKNOWN";
        const date = game.endedAt
          ? new Date(game.endedAt).toLocaleDateString()
          : "N/A";

        historyText += `${i + 1}. ${
          isHot ? "🔥" : "❄️"
        } ${colorName} (${date})\n`;
      }

      embed.addFields(
        {
          name: "Last 15 Games",
          value: historyText || "No games found",
          inline: false,
        },
        { name: "Hot Results", value: hotCount.toString(), inline: true },
        { name: "Cold Results", value: coldCount.toString(), inline: true },
        { name: "Total Games", value: history.length.toString(), inline: true }
      );

      // Send embed
      await message.reply({
        embeds: [embed],
      });
    } catch (error) {
      // Handle errors for prefix command
      if (error instanceof ValidationError) {
        await message.reply(`⚠️ ${error.message}`);
      } else {
        console.error("Error in !hotcoldhistory command:", error);
        await message.reply(
          "❌ An error occurred while retrieving Hot/Cold history."
        );
      }
    }
  },

  // Command aliases
  aliases: ["hch"],
};
