// commands/dicetable.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  startDiceGame,
  toggleDiceBetting,
  cancelDiceGame,
  getActiveDiceGame,
} = require("../utils/DiceManager");
const { EMOJIS } = require("../utils/embedcreator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dicetable")
    .setDescription("Manage your dice table.")
    .addStringOption((option) =>
      option
        .setName("subcommand")
        .setDescription("The action to perform")
        .setRequired(true)
        .addChoices(
          { name: "open", value: "open" },
          { name: "bets", value: "toggle-bets" },
          { name: "close", value: "cancel" }
        )
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const subcommand = interaction.options.getString("subcommand");
      const hostId = interaction.user.id;

      // Check if user is a host
      const isHost = interaction.member.roles.cache.has(
        process.env.HOST_ROLE_ID
      );
      const isAdmin = interaction.member.permissions.has("Administrator");

      if (!isHost && !isAdmin) {
        return interaction.editReply({
          content: "❌ You do not have permission to use this command.",
        });
      }

      if (subcommand === "open") {
        // Open a new dice table
        const result = await startDiceGame(hostId);

        if (!result.success) {
          return interaction.editReply({ content: `❌ ${result.message}` });
        }

        const embed = new EmbedBuilder()
          .setColor(0x9c27b0)
          .setTitle(`${EMOJIS.dice} Dice Table Opened`)
          .setDescription(
            `${interaction.user.toString()} has opened a dice table!`
          )
          .addFields(
            { name: "Status", value: "Open for betting", inline: true },
            {
              name: "How to Bet",
              value: "Use `/dice` to place bets",
              inline: true,
            }
          )
          .setFooter({ text: "Use /rollresult to submit the roll result" })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else if (subcommand === "bets" || subcommand === "toggle-bets") {
        // Toggle betting status
        const result = await toggleDiceBetting(hostId);

        if (!result.success) {
          return interaction.editReply({ content: `❌ ${result.message}` });
        }

        const status = result.isOpen
          ? "Open for betting"
          : "Closed for betting";

        const embed = new EmbedBuilder()
          .setColor(0x9c27b0)
          .setTitle(`${EMOJIS.dice} Dice Table Status Updated`)
          .setDescription(
            `${interaction.user.toString()}'s dice table is now: **${status}**`
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } else if (subcommand === "cancel") {
        // Cancel the dice table
        const result = await cancelDiceGame(hostId);

        if (!result.success) {
          return interaction.editReply({ content: `❌ ${result.message}` });
        }

        const embed = new EmbedBuilder()
          .setColor(0xff5722)
          .setTitle(`${EMOJIS.dice} Dice Table Cancelled`)
          .setDescription(
            `${interaction.user.toString()} has cancelled their dice table. All bets have been refunded.`
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error("Error in /dicetable command:", error);
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: "❌ An error occurred while managing the dice table.",
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      const hostId = message.author.id;

      // Check if user is a host
      const isHost = message.member.roles.cache.has(process.env.HOST_ROLE_ID);
      const isAdmin = message.member.permissions.has("Administrator");

      if (!isHost && !isAdmin) {
        return message.reply(
          "❌ You do not have permission to use this command."
        );
      }

      if (!args[0]) {
        return message.reply(
          "❌ Please specify an action: open, toggle-bets, or cancel."
        );
      }

      const subcommand = args[0].toLowerCase();

      if (subcommand === "open") {
        // Open a new dice table
        const result = await startDiceGame(hostId);

        if (!result.success) {
          return message.reply(`❌ ${result.message}`);
        }

        const embed = new EmbedBuilder()
          .setColor(0x9c27b0)
          .setTitle(`${EMOJIS.dice} Dice Table Opened`)
          .setDescription(
            `${message.author.toString()} has opened a dice table!`
          )
          .addFields(
            { name: "Status", value: "Open for betting", inline: true },
            {
              name: "How to Bet",
              value: "Use `!dice` to place bets",
              inline: true,
            }
          )
          .setFooter({ text: "Use !rollresult to submit the roll result" })
          .setTimestamp();

        await message.reply({ embeds: [embed] });
      } else if (subcommand === "toggle-bets" || subcommand === "bets") {
        // Toggle betting status
        const result = await toggleDiceBetting(hostId);

        if (!result.success) {
          return message.reply(`❌ ${result.message}`);
        }

        const status = result.isOpen
          ? "Open for betting"
          : "Closed for betting";

        const embed = new EmbedBuilder()
          .setColor(0x9c27b0)
          .setTitle(`${EMOJIS.dice} Dice Table Status Updated`)
          .setDescription(
            `${message.author.toString()}'s dice table is now: **${status}**`
          )
          .setTimestamp();

        await message.reply({ embeds: [embed] });
      } else if (subcommand === "cancel") {
        // Cancel the dice table
        const result = await cancelDiceGame(hostId);

        if (!result.success) {
          return message.reply(`❌ ${result.message}`);
        }

        const embed = new EmbedBuilder()
          .setColor(0xff5722)
          .setTitle(`${EMOJIS.dice} Dice Table Cancelled`)
          .setDescription(
            `${message.author.toString()} has cancelled their dice table. All bets have been refunded.`
          )
          .setTimestamp();

        await message.reply({ embeds: [embed] });
      } else {
        return message.reply(
          "❌ Invalid action. Please use open, toggle-bets, or cancel."
        );
      }
    } catch (error) {
      console.error("Error in !dicetable command:", error);
      await message.reply(
        "❌ An error occurred while managing the dice table."
      );
    }
  },
};

// This command allows hosts to manage their dicing tables, including opening and cancelling them.
// It checks permissions, handles the game state, and provides feedback to users.
