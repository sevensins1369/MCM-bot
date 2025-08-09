// commands/hotcold.js
// Command to start or toggle a Hot/Cold game

const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { EMOJIS } = require("../utils/embedcreator");
const {
  ValidationError,
  withErrorHandling,
} = require("../utils/error-handler");
const HotColdManager = require("../utils/HotColdManager");

module.exports = {
  // Slash command definition
  data: new SlashCommandBuilder()
    .setName("hotcold")
    .setDescription("Start a Hot/Cold game or toggle betting open/closed"),

  // Slash command execution
  execute: withErrorHandling(async function (interaction) {
    await interaction.deferReply();

    // Check if user already has an active game
    const existingGame = HotColdManager.getActiveGame(interaction.user.id);

    if (existingGame) {
      // If game exists, toggle betting open/closed
      if (existingGame.isOpen) {
        // Close betting
        HotColdManager.closeBetting(interaction.user.id);

        // Create embed for closed betting
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

        // Send embed
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
                  custom_id: `hc_cancel_game:${interaction.user.id}`,
                },
              ],
            },
          ],
        });
      } else if (!existingGame.result) {
        // Reopen betting if no result has been set yet
        HotColdManager.reopenBetting(interaction.user.id);

        // Create embed for reopened betting
        const embed = new EmbedBuilder()
          .setTitle(
            `${EMOJIS.fire || "🔥"} HOT COLD ${
              EMOJIS.snowflake || "❄️"
            } Betting Reopened`
          )
          .setColor(0xff5733)
          .setDescription(
            `${interaction.user.toString()} has reopened betting for their Hot/Cold game.`
          )
          .addFields(
            {
              name: "🔥 HOT COLORS 🔥",
              value: "Red, Orange, Yellow, Black",
              inline: false,
            },
            {
              name: "❄️ COLD COLORS ❄️",
              value: "Blue, Green, Purple, White",
              inline: false,
            },
            {
              name: "How to Play",
              value:
                "Place bets with `/hotcoldbet`\n• Bet on HOT or COLD: 1.85x payout\n• Bet on exact color: 5x payout",
              inline: false,
            }
          )
          .setTimestamp();

        // Send embed
        await interaction.editReply({
          embeds: [embed],
          components: [
            {
              type: 1, // Action Row
              components: [
                {
                  type: 2, // Button
                  style: 1, // Primary (blue)
                  label: "Close Betting",
                  custom_id: `hc_close_betting:${interaction.user.id}`,
                },
                {
                  type: 2, // Button
                  style: 4, // Danger (red)
                  label: "Cancel Game",
                  custom_id: `hc_cancel_game:${interaction.user.id}`,
                },
              ],
            },
          ],
        });
      } else {
        // If result is already set, inform the host
        throw new ValidationError(
          "Your Hot/Cold game already has a result. Start a new game instead."
        );
      }
    } else {
      // Create a new game if none exists
      const game = await HotColdManager.createGame(interaction.user.id);

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(
          `${EMOJIS.fire || "🔥"} HOT COLD ${
            EMOJIS.snowflake || "❄️"
          } Game Started`
        )
        .setColor(0xff5733) // Hot orange-red color
        .setDescription(
          `${interaction.user.toString()} has started a Hot/Cold game!`
        )
        .addFields(
          { name: "Status", value: "Open for Betting", inline: true },
          { name: "Game ID", value: game.id, inline: true },
          {
            name: "🔥 HOT COLORS 🔥",
            value: "Red, Orange, Yellow, Black",
            inline: false,
          },
          {
            name: "❄️ COLD COLORS ❄️",
            value: "Blue, Green, Purple, White",
            inline: false,
          },
          {
            name: "How to Play",
            value:
              "Place bets with `/hotcoldbet`\n• Bet on HOT or COLD: 1.85x payout\n• Bet on exact color: 5x payout",
            inline: false,
          }
        )
        .setFooter({ text: "Use /hotcold again to close betting when ready" })
        .setTimestamp();

      // Create buttons
      const components = [
        {
          type: 1, // Action Row
          components: [
            {
              type: 2, // Button
              style: 1, // Primary (blue)
              label: "Close Betting",
              custom_id: `hc_close_betting:${interaction.user.id}`,
            },
            {
              type: 2, // Button
              style: 4, // Danger (red)
              label: "Cancel Game",
              custom_id: `hc_cancel_game:${interaction.user.id}`,
            },
          ],
        },
      ];

      // Send embed
      await interaction.editReply({
        embeds: [embed],
        components,
      });
    }
  }, "HotColdCommand"),

  // Prefix command execution
  async run(message, args) {
    try {
      // Check if user already has an active game
      const existingGame = HotColdManager.getActiveGame(message.author.id);

      if (existingGame) {
        // If game exists, toggle betting open/closed
        if (existingGame.isOpen) {
          // Close betting
          HotColdManager.closeBetting(message.author.id);

          // Create embed for closed betting
          const embed = new EmbedBuilder()
            .setTitle(
              `${EMOJIS.fire || "🔥"} HOT COLD ${
                EMOJIS.snowflake || "❄️"
              } Betting Closed`
            )
            .setColor(0xff5733)
            .setDescription(
              `${message.author.toString()} has closed betting for their Hot/Cold game.`
            )
            .addFields({
              name: "Next Step",
              value: "Use `!hotcoldresult` to enter the result of your roll.",
              inline: false,
            })
            .setTimestamp();

          // Send embed
          await message.reply({
            embeds: [embed],
            components: [
              {
                type: 1, // Action Row
                components: [
                  {
                    type: 2, // Button
                    style: 4, // Danger (red)
                    label: "Cancel Game",
                    custom_id: `hc_cancel_game:${message.author.id}`,
                  },
                ],
              },
            ],
          });
        } else if (!existingGame.result) {
          // Reopen betting if no result has been set yet
          HotColdManager.reopenBetting(message.author.id);

          // Create embed for reopened betting
          const embed = new EmbedBuilder()
            .setTitle(
              `${EMOJIS.fire || "🔥"} HOT COLD ${
                EMOJIS.snowflake || "❄️"
              } Betting Reopened`
            )
            .setColor(0xff5733)
            .setDescription(
              `${message.author.toString()} has reopened betting for their Hot/Cold game.`
            )
            .addFields(
              {
                name: "🔥 HOT COLORS 🔥",
                value: "Red, Orange, Yellow, Black",
                inline: false,
              },
              {
                name: "❄️ COLD COLORS ❄️",
                value: "Blue, Green, Purple, White",
                inline: false,
              },
              {
                name: "How to Play",
                value:
                  "Place bets with `!hotcoldbet`\n• Bet on HOT or COLD: 1.85x payout\n• Bet on exact color: 5x payout",
                inline: false,
              }
            )
            .setTimestamp();

          // Send embed
          await message.reply({
            embeds: [embed],
            components: [
              {
                type: 1, // Action Row
                components: [
                  {
                    type: 2, // Button
                    style: 1, // Primary (blue)
                    label: "Close Betting",
                    custom_id: `hc_close_betting:${message.author.id}`,
                  },
                  {
                    type: 2, // Button
                    style: 4, // Danger (red)
                    label: "Cancel Game",
                    custom_id: `hc_cancel_game:${message.author.id}`,
                  },
                ],
              },
            ],
          });
        } else {
          // If result is already set, inform the host
          throw new ValidationError(
            "Your Hot/Cold game already has a result. Start a new game instead."
          );
        }
      } else {
        // Create a new game if none exists
        const game = await HotColdManager.createGame(message.author.id);

        // Create embed
        const embed = new EmbedBuilder()
          .setTitle(
            `${EMOJIS.fire || "🔥"} HOT COLD ${
              EMOJIS.snowflake || "❄️"
            } Game Started`
          )
          .setColor(0xff5733) // Hot orange-red color
          .setDescription(
            `${message.author.toString()} has started a Hot/Cold game!`
          )
          .addFields(
            { name: "Status", value: "Open for Betting", inline: true },
            { name: "Game ID", value: game.id, inline: true },
            {
              name: "🔥 HOT COLORS 🔥",
              value: "Red, Orange, Yellow, Black",
              inline: false,
            },
            {
              name: "❄️ COLD COLORS ❄️",
              value: "Blue, Green, Purple, White",
              inline: false,
            },
            {
              name: "How to Play",
              value:
                "Place bets with `!hotcoldbet`\n• Bet on HOT or COLD: 1.85x payout\n• Bet on exact color: 5x payout",
              inline: false,
            }
          )
          .setFooter({ text: "Use !hotcold again to close betting when ready" })
          .setTimestamp();

        // Create buttons
        const components = [
          {
            type: 1, // Action Row
            components: [
              {
                type: 2, // Button
                style: 1, // Primary (blue)
                label: "Close Betting",
                custom_id: `hc_close_betting:${message.author.id}`,
              },
              {
                type: 2, // Button
                style: 4, // Danger (red)
                label: "Cancel Game",
                custom_id: `hc_cancel_game:${message.author.id}`,
              },
            ],
          },
        ];

        // Send embed
        await message.reply({
          embeds: [embed],
          components,
        });
      }
    } catch (error) {
      // Handle errors for prefix command
      if (error instanceof ValidationError) {
        await message.reply(`⚠️ ${error.message}`);
      } else {
        console.error("Error in !hotcold command:", error);
        await message.reply("❌ An error occurred with the Hot/Cold game.");
      }
    }
  },
};
