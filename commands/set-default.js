// commands/set-default.js
const { SlashCommandBuilder } = require("discord.js");
const { setDefaultCurrency } = require("../utils/UserPreferencesManager");
const { EMOJIS } = require("../utils/embedcreator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("set-default")
    .setDescription("Set your default currency for commands.")
    .addStringOption((option) =>
      option
        .setName("currency")
        .setDescription("The currency to set as default")
        .setRequired(true)
        .addChoices(
          { name: "07", value: "osrs" },
          { name: "RS3", value: "rs3" }
        )
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const currency = interaction.options.getString("currency");
      const userId = interaction.user.id;

      await setDefaultCurrency(userId, currency);

      const currencyDisplay = currency === "osrs" ? "osrs" : "RS3";
      await interaction.editReply({
        content: `${EMOJIS.win} Your default currency has been set to **${currencyDisplay}**. This will be used when you don't specify a currency in betting and sending commands.`,
      });
    } catch (error) {
      console.error("Error in /set-default command:", error);
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: `❌ An error occurred: ${error.message}`,
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      if (args.length < 1) {
        return message.reply(
          "❌ Please specify a currency (osrs or rs3). Usage: `!set-default <currency>`"
        );
      }

      const currencyInput = args[0].toLowerCase();
      let currency;

      if (currencyInput === "osrs" || currencyInput === "osrs") {
        currency = "osrs";
      } else if (currencyInput === "rs3") {
        currency = "rs3";
      } else {
        return message.reply(
          "❌ Invalid currency. Please use 'osrs' or 'rs3'."
        );
      }

      const userId = message.author.id;

      await setDefaultCurrency(userId, currency);

      const currencyDisplay = currency === "osrs" ? "osrs" : "RS3";
      await message.reply(
        `${EMOJIS.win} Your default currency has been set to **${currencyDisplay}**. This will be used when you don't specify a currency in betting and sending commands.`
      );
    } catch (error) {
      console.error("Error in !set-default command:", error);
      await message.reply(`❌ An error occurred: ${error.message}`);
    }
  },
};

// This command allows users to set their default currency for commands like wallet and host leaderboard.
// It updates the user's preferences in the database and provides feedback on the change.
