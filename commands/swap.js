// commands/swap.js
const { SlashCommandBuilder } = require("discord.js");
const parseAmount = require("../utils/parseAmount");
const { getWallet, updateWallet } = require("../utils/WalletManager");
const { formatAmount } = require("../utils/embedcreator");
const { logger } = require("../enhanced-logger");

// Get the swap channel ID from environment variables
const SWAP_CHANNEL_ID = process.env.SWAP_CHANNEL_ID;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("swap")
    .setDescription("Swap between osrs and RS3 coins")
    .addStringOption((opt) =>
      opt
        .setName("direction")
        .setDescription("Swap direction")
        .setRequired(true)
        .addChoices(
          { name: "osrs → RS3", value: "osrs_to_rs3" },
          { name: "RS3 → osrs", value: "rs3_to_osrs" }
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
      // Check if the command is being used in the designated swap channel
      if (SWAP_CHANNEL_ID && interaction.channelId !== SWAP_CHANNEL_ID) {
        return interaction.reply({
          content: `❌ This command can only be used in <#${SWAP_CHANNEL_ID}>.`,
          ephemeral: true,
        });
      }

      const userId = interaction.user.id;
      const direction = interaction.options.getString("direction");
      const rawAmount = interaction.options.getString("amount");

      logger.info(
        "SwapCommand",
        `Swap requested by ${interaction.user.tag} for ${rawAmount} ${direction}`
      );

      // Parse amount safely
      let amount;
      try {
        amount = parseAmount(rawAmount);
        if (!amount || amount <= 0n) {
          return interaction.reply({
            content: "❌ Invalid amount format.",
            ephemeral: true,
          });
        }
      } catch (error) {
        logger.error("SwapCommand", `Error parsing amount: ${error.message}`, {
          rawAmount,
        });
        return interaction.reply({
          content: "❌ Invalid amount format.",
          ephemeral: true,
        });
      }

      const wallet = await getWallet(userId);
      let responseAmount;
      let responseCurrency;

      if (direction === "osrs_to_rs3") {
        if (wallet.osrs < amount) {
          return interaction.reply({
            content: "❌ Not enough osrs coins.",
            ephemeral: true,
          });
        }

        // Safely perform BigInt operations
        try {
          wallet.osrs = BigInt(wallet.osrs) - BigInt(amount);
          const convertedAmount = BigInt(amount) * BigInt(10);
          wallet.rs3 = BigInt(wallet.rs3) + convertedAmount;
          responseAmount = convertedAmount;
          responseCurrency = "RS3";
        } catch (error) {
          logger.error(
            "SwapCommand",
            `Error in BigInt operations (osrs to RS3): ${error.message}`,
            {
              userId,
              amount: amount.toString(),
              walletOsrs: wallet.osrs.toString(),
              walletRs3: wallet.rs3.toString(),
            }
          );
          return interaction.reply({
            content: "❌ An error occurred during the swap calculation.",
            ephemeral: true,
          });
        }
      } else {
        // rs3_to_osrs
        if (wallet.rs3 < amount) {
          return interaction.reply({
            content: "❌ Not enough RS3 coins.",
            ephemeral: true,
          });
        }

        // Safely perform BigInt operations
        try {
          wallet.rs3 = BigInt(wallet.rs3) - BigInt(amount);
          const convertedAmount = BigInt(amount) / BigInt(10);
          wallet.osrs = BigInt(wallet.osrs) + convertedAmount;
          responseAmount = convertedAmount;
          responseCurrency = "osrs";
        } catch (error) {
          logger.error(
            "SwapCommand",
            `Error in BigInt operations (RS3 to osrs): ${error.message}`,
            {
              userId,
              amount: amount.toString(),
              walletOsrs: wallet.osrs.toString(),
              walletRs3: wallet.rs3.toString(),
            }
          );
          return interaction.reply({
            content: "❌ An error occurred during the swap calculation.",
            ephemeral: true,
          });
        }
      }

      await updateWallet(userId, wallet);

      await interaction.reply(
        `✅ Swapped **${rawAmount} ${
          direction === "osrs_to_rs3" ? "osrs" : "RS3"
        }** → **${formatAmount(responseAmount)} ${responseCurrency}**.`
      );

      logger.info(
        "SwapCommand",
        `Swap completed for ${interaction.user.username}`,
        {
          from: `${rawAmount} ${direction === "osrs_to_rs3" ? "osrs" : "RS3"}`,
          to: `${formatAmount(responseAmount)} ${responseCurrency}`,
        }
      );
    } catch (error) {
      logger.error(
        "SwapCommand",
        `Error in swap command: ${error.message}`,
        error
      );
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
      // Check if the command is being used in the designated swap channel
      if (SWAP_CHANNEL_ID && message.channelId !== SWAP_CHANNEL_ID) {
        return message.reply(
          `❌ This command can only be used in <#${SWAP_CHANNEL_ID}>.`
        );
      }

      if (args.length < 2) {
        return message.reply(
          "❌ Invalid command usage. Format: `!swap <direction> <amount>`\nDirections: `osrstors3` or `rs3toosrs`"
        );
      }

      const directionInput = args[0].toLowerCase();
      const rawAmount = args[1];

      let direction;
      if (
        directionInput === "osrstors3" ||
        directionInput === "osrs_to_rs3" ||
        directionInput === "osrs-to-rs3"
      ) {
        direction = "osrs_to_rs3";
      } else if (
        directionInput === "rs3toosrs" ||
        directionInput === "rs3_to_osrs" ||
        directionInput === "rs3-to-osrs"
      ) {
        direction = "rs3_to_osrs";
      } else {
        return message.reply(
          "❌ Invalid direction. Use `osrstors3` or `rs3toosrs`."
        );
      }

      logger.info(
        "SwapCommand",
        `Swap requested by ${message.author.tag} for ${rawAmount} ${direction}`
      );

      // Parse amount safely
      let amount;
      try {
        amount = parseAmount(rawAmount);
        if (!amount || amount <= 0n) {
          return message.reply("❌ Invalid amount format.");
        }
      } catch (error) {
        logger.error("SwapCommand", `Error parsing amount: ${error.message}`, {
          rawAmount,
        });
        return message.reply("❌ Invalid amount format.");
      }

      const userId = message.author.id;
      const wallet = await getWallet(userId);
      let responseAmount;
      let responseCurrency;

      if (direction === "osrs_to_rs3") {
        if (wallet.osrs < amount) {
          return message.reply("❌ Not enough osrs coins.");
        }

        // Safely perform BigInt operations
        try {
          wallet.osrs = BigInt(wallet.osrs) - BigInt(amount);
          const convertedAmount = BigInt(amount) * BigInt(10);
          wallet.rs3 = BigInt(wallet.rs3) + convertedAmount;
          responseAmount = convertedAmount;
          responseCurrency = "RS3";
        } catch (error) {
          logger.error(
            "SwapCommand",
            `Error in BigInt operations (osrs to RS3): ${error.message}`,
            {
              userId,
              amount: amount.toString(),
              walletOsrs: wallet.osrs.toString(),
              walletRs3: wallet.rs3.toString(),
            }
          );
          return message.reply(
            "❌ An error occurred during the swap calculation."
          );
        }
      } else {
        // rs3_to_osrs
        if (wallet.rs3 < amount) {
          return message.reply("❌ Not enough RS3 coins.");
        }

        // Safely perform BigInt operations
        try {
          wallet.rs3 = BigInt(wallet.rs3) - BigInt(amount);
          const convertedAmount = BigInt(amount) / BigInt(10);
          wallet.osrs = BigInt(wallet.osrs) + convertedAmount;
          responseAmount = convertedAmount;
          responseCurrency = "osrs";
        } catch (error) {
          logger.error(
            "SwapCommand",
            `Error in BigInt operations (RS3 to osrs): ${error.message}`,
            {
              userId,
              amount: amount.toString(),
              walletOsrs: wallet.osrs.toString(),
              walletRs3: wallet.rs3.toString(),
            }
          );
          return message.reply(
            "❌ An error occurred during the swap calculation."
          );
        }
      }

      await updateWallet(userId, wallet);

      await message.reply(
        `✅ Swapped **${rawAmount} ${
          direction === "osrs_to_rs3" ? "osrs" : "RS3"
        }** → **${formatAmount(responseAmount)} ${responseCurrency}**.`
      );

      logger.info(
        "SwapCommand",
        `Swap completed for ${message.author.username}`,
        {
          from: `${rawAmount} ${direction === "osrs_to_rs3" ? "osrs" : "RS3"}`,
          to: `${formatAmount(responseAmount)} ${responseCurrency}`,
        }
      );
    } catch (error) {
      logger.error(
        "SwapCommand",
        `Error in !swap command: ${error.message}`,
        error
      );
      await message.reply("❌ An error occurred while processing the swap.");
    }
  },
};

// This command allows users to swap between osrs and RS3 coins.
// It validates the amount, checks the user's balance, performs the swap, and updates the wallet
