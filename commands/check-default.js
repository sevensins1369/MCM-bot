// commands/check-default.js
const { SlashCommandBuilder } = require("discord.js");
const { getDefaultCurrency } = require("../utils/UserPreferencesManager");
const { EMOJIS } = require("../utils/embedcreator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("check-default")
    .setDescription("Check your default currency setting."),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const userId = interaction.user.id;

      try {
        const defaultCurrency = await getDefaultCurrency(userId);
        const currencyDisplay = defaultCurrency === "osrs" ? "07" : "RS3";

        await interaction.editReply({
          content: `${EMOJIS.stash} Your default currency is set to **${currencyDisplay}**. This is used when you don't specify a currency in betting and sending commands.`,
        });
      } catch (error) {
        console.error("Error getting default currency:", error);
        await interaction.editReply({
          content:
            "❌ Could not retrieve your default currency. It has been reset to 07.",
        });
      }
    } catch (error) {
      console.error("Error in /check-default command:", error);
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
      const userId = message.author.id;

      try {
        const defaultCurrency = await getDefaultCurrency(userId);
        const currencyDisplay = defaultCurrency === "osrs" ? "07" : "RS3";

        await message.reply(
          `${EMOJIS.stash} Your default currency is set to **${currencyDisplay}**. This is used when you don't specify a currency in betting and sending commands.`
        );
      } catch (error) {
        console.error("Error getting default currency:", error);
        await message.reply(
          "❌ Could not retrieve your default currency. It has been reset to 07."
        );
      }
    } catch (error) {
      console.error("Error in !check-default command:", error);
      await message.reply(`❌ An error occurred: ${error.message}`);
    }
  },
};

// This command allows users to check their default currency setting.
// It retrieves the user's default currency from the database and provides feedback on the current setting.
