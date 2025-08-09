// commands/swap.js
const { SlashCommandBuilder } = require("discord.js");
const parseAmount = require("../utils/parseAmount");
const { getWallet, updateWallet } = require("../utils/WalletManager");
const { formatAmount } = require("../utils/embedcreator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("swap")
    .setDescription("Swap between 07 and RS3 coins")
    .addStringOption((opt) =>
      opt
        .setName("direction")
        .setDescription("Swap direction")
        .setRequired(true)
        .addChoices(
          { name: "07 → RS3", value: "07_to_rs3" },
          { name: "RS3 → 07", value: "rs3_to_07" }
        )
    )
    .addStringOption((opt) =>
      opt
        .setName("amount")
        .setDescription("Amount to swap (supports 1k, 2.5m, 1b)")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const userId = interaction.user.id;
      const direction = interaction.options.getString("direction");
      const rawAmount = interaction.options.getString("amount");

      console.log(
        `[EXECUTE] /swap by ${interaction.user.tag} for ${rawAmount} ${direction}`
      );

      const amount = parseAmount(rawAmount); // Returns BigInt
      if (amount <= 0n) {
        return interaction.reply({
          content: "❌ Invalid amount format.",
          ephemeral: true,
        });
      }

      const wallet = await getWallet(userId);
      let responseAmount;
      let responseCurrency;

      if (direction === "07_to_rs3") {
        if (wallet.osrs < amount) {
          return interaction.reply({
            content: "❌ Not enough 07 coins.",
            ephemeral: true,
          });
        }
        wallet.osrs -= amount;
        wallet.rs3 += amount * 10n; // BigInt math
        responseAmount = amount * 10n;
        responseCurrency = "RS3";
      } else {
        // rs3_to_07
        if (wallet.rs3 < amount) {
          return interaction.reply({
            content: "❌ Not enough RS3 coins.",
            ephemeral: true,
          });
        }
        const converted = amount / 10n; // BigInt math
        wallet.rs3 -= amount;
        wallet.osrs += converted;
        responseAmount = converted;
        responseCurrency = "07";
      }

      await updateWallet(userId, wallet);

      await interaction.reply(
        `✅ Swapped **${rawAmount} ${
          direction === "07_to_rs3" ? "07" : "RS3"
        }** → **${formatAmount(responseAmount)} ${responseCurrency}**.`
      );
      console.log(
        `${interaction.user.username} swapped ${rawAmount} for ${formatAmount(
          responseAmount
        )} ${responseCurrency}`
      );
    } catch (error) {
      console.error("Error in /swap command:", error);
      const replyMethod =
        interaction.replied || interaction.deferred ? "followUp" : "reply";
      await interaction[replyMethod]({
        content: "❌ An error occurred while processing the swap.",
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      if (args.length < 2) {
        return message.reply(
          "❌ Invalid command usage. Format: `!swap <direction> <amount>`\nDirections: `07tors3` or `rs3to07`"
        );
      }

      const directionInput = args[0].toLowerCase();
      const rawAmount = args[1];

      let direction;
      if (
        directionInput === "07tors3" ||
        directionInput === "07_to_rs3" ||
        directionInput === "07-to-rs3"
      ) {
        direction = "07_to_rs3";
      } else if (
        directionInput === "rs3to07" ||
        directionInput === "rs3_to_07" ||
        directionInput === "rs3-to-07"
      ) {
        direction = "rs3_to_07";
      } else {
        return message.reply(
          "❌ Invalid direction. Use `07tors3` or `rs3to07`."
        );
      }

      console.log(
        `[RUN] !swap by ${message.author.tag} for ${rawAmount} ${direction}`
      );

      const amount = parseAmount(rawAmount); // Returns BigInt
      if (amount <= 0n) {
        return message.reply("❌ Invalid amount format.");
      }

      const userId = message.author.id;
      const wallet = await getWallet(userId);
      let responseAmount;
      let responseCurrency;

      if (direction === "07_to_rs3") {
        if (wallet.osrs < amount) {
          return message.reply("❌ Not enough 07 coins.");
        }
        wallet.osrs -= amount;
        wallet.rs3 += amount * 10n; // BigInt math
        responseAmount = amount * 10n;
        responseCurrency = "RS3";
      } else {
        // rs3_to_07
        if (wallet.rs3 < amount) {
          return message.reply("❌ Not enough RS3 coins.");
        }
        const converted = amount / 10n; // BigInt math
        wallet.rs3 -= amount;
        wallet.osrs += converted;
        responseAmount = converted;
        responseCurrency = "07";
      }

      await updateWallet(userId, wallet);

      await message.reply(
        `✅ Swapped **${rawAmount} ${
          direction === "07_to_rs3" ? "07" : "RS3"
        }** → **${formatAmount(responseAmount)} ${responseCurrency}**.`
      );
      console.log(
        `${message.author.username} swapped ${rawAmount} for ${formatAmount(
          responseAmount
        )} ${responseCurrency}`
      );
    } catch (error) {
      console.error("Error in !swap command:", error);
      await message.reply("❌ An error occurred while processing the swap.");
    }
  },
};

// This command allows users to swap between 07 and RS3 coins.
// It validates the amount, checks the user's balance, performs the swap, and updates the wallet
