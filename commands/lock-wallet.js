// commands/lock-wallet.js
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { getWallet, updateWallet } = require("../utils/WalletManager");
const { EMOJIS } = require("../utils/embedcreator");
const { logger } = require("../enhanced-logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lock-wallet")
    .setDescription("Lock or unlock a wallet to prevent transactions.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("lock")
        .setDescription("Lock a wallet.")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription(
              "The user to lock (Admins only). Leave blank to lock yourself."
            )
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName("duration")
            .setDescription("How long to lock your own wallet for.")
            .setRequired(false)
            .addChoices(
              { name: "1 Hour", value: "1h" },
              { name: "6 Hours", value: "6h" },
              { name: "12 Hours", value: "12h" },
              { name: "1 Day", value: "1d" },
              { name: "3 Days", value: "3d" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("unlock")
        .setDescription("Unlock a wallet.")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user to unlock (Admins only).")
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const subcommand = interaction.options.getSubcommand();
      const isAdmin = interaction.member.permissions.has(
        PermissionFlagsBits.Administrator
      );

      if (subcommand === "lock") {
        const targetUser =
          interaction.options.getUser("user") || interaction.user;
        const duration = interaction.options.getString("duration");

        if (targetUser.id !== interaction.user.id && !isAdmin) {
          return interaction.editReply({
            content:
              "❌ You can only lock your own wallet. Admins can lock others.",
          });
        }
        if (duration && targetUser.id !== interaction.user.id) {
          return interaction.editReply({
            content: "❌ Durations can only be set when self-locking.",
          });
        }

        try {
          const wallet = await getWallet(targetUser.id);
          if (wallet.isLocked) {
            return interaction.editReply({
              content: "This wallet is already locked.",
            });
          }

          let lockExpiresAt = null;
          if (duration) {
            const now = Date.now();
            const durations = {
              "1h": 3600000,
              "6h": 21600000,
              "12h": 43200000,
              "1d": 86400000,
              "3d": 259200000,
            };
            lockExpiresAt = new Date(now + durations[duration]);
          }

          wallet.isLocked = true;
          wallet.lockExpiresAt = lockExpiresAt;
          await updateWallet(targetUser.id, wallet);

          let replyMessage = `${
            EMOJIS.win
          } Successfully locked the wallet for ${targetUser.toString()}.`;
          if (lockExpiresAt) {
            replyMessage += ` It will automatically unlock <t:${Math.floor(
              lockExpiresAt.getTime() / 1000
            )}:R>.`;
          }

          logger.info(
            "LockWalletCommand",
            `Wallet locked for user ${targetUser.id}`,
            {
              lockedBy: interaction.user.id,
              duration: duration || "indefinite",
              expiresAt: lockExpiresAt ? lockExpiresAt.toISOString() : null,
            }
          );

          await interaction.editReply(replyMessage);
        } catch (error) {
          logger.error(
            "LockWalletCommand",
            `Error locking wallet: ${error.message}`,
            error
          );
          await interaction.editReply(
            "❌ An error occurred while locking the wallet."
          );
        }
      } else if (subcommand === "unlock") {
        const targetUser = interaction.options.getUser("user");
        if (!isAdmin) {
          return interaction.editReply({
            content: "❌ Only admins can unlock wallets.",
          });
        }

        try {
          const wallet = await getWallet(targetUser.id);
          if (!wallet.isLocked) {
            return interaction.editReply({
              content: "This wallet is not locked.",
            });
          }

          wallet.isLocked = false;
          wallet.lockExpiresAt = null;
          await updateWallet(targetUser.id, wallet);

          logger.info(
            "LockWalletCommand",
            `Wallet unlocked for user ${targetUser.id}`,
            {
              unlockedBy: interaction.user.id,
            }
          );

          await interaction.editReply(
            `${
              EMOJIS.win
            } Successfully unlocked the wallet for ${targetUser.toString()}.`
          );
        } catch (error) {
          logger.error(
            "LockWalletCommand",
            `Error unlocking wallet: ${error.message}`,
            error
          );
          await interaction.editReply(
            "❌ An error occurred while unlocking the wallet."
          );
        }
      }
    } catch (error) {
      logger.error(
        "LockWalletCommand",
        `General error: ${error.message}`,
        error
      );
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
          "❌ Invalid command usage. Format: `!lock <lock> [1h/6h/12h/1d/3d]`"
        );
      }

      const subcommand = args[0].toLowerCase();
      const isAdmin = message.member.permissions.has(
        PermissionFlagsBits.Administrator
      );

      if (subcommand === "lock") {
        let targetUser = message.author;
        let duration = null;
        let durationIndex = -1;

        // Check if a user mention is provided
        if (
          args.length > 1 &&
          args[1].startsWith("<@") &&
          args[1].endsWith(">")
        ) {
          const userId = args[1].replace(/[<@!>]/g, "");
          targetUser = await message.client.users
            .fetch(userId)
            .catch(() => message.author);
          durationIndex = 2;
        } else {
          durationIndex = 1;
        }

        // Check for duration
        if (args.length > durationIndex) {
          const durationArg = args[durationIndex].toLowerCase();
          if (["1h", "6h", "12h", "1d", "3d"].includes(durationArg)) {
            duration = durationArg;
          }
        }

        if (targetUser.id !== message.author.id && !isAdmin) {
          return message.reply(
            "❌ You can only lock your own wallet. Admins can lock others."
          );
        }
        if (duration && targetUser.id !== message.author.id) {
          return message.reply(
            "❌ Durations can only be set when self-locking."
          );
        }

        try {
          const wallet = await getWallet(targetUser.id);
          if (wallet.isLocked) {
            return message.reply("This wallet is already locked.");
          }

          let lockExpiresAt = null;
          if (duration) {
            const now = Date.now();
            const durations = {
              "1h": 3600000,
              "6h": 21600000,
              "12h": 43200000,
              "1d": 86400000,
              "3d": 259200000,
            };
            lockExpiresAt = new Date(now + durations[duration]);
          }

          wallet.isLocked = true;
          wallet.lockExpiresAt = lockExpiresAt;
          await updateWallet(targetUser.id, wallet);

          let replyMessage = `${
            EMOJIS.win
          } Successfully locked the wallet for ${targetUser.toString()}.`;
          if (lockExpiresAt) {
            replyMessage += ` It will automatically unlock <t:${Math.floor(
              lockExpiresAt.getTime() / 1000
            )}:R>.`;
          }

          logger.info(
            "LockWalletCommand",
            `Wallet locked for user ${targetUser.id}`,
            {
              lockedBy: message.author.id,
              duration: duration || "indefinite",
              expiresAt: lockExpiresAt ? lockExpiresAt.toISOString() : null,
            }
          );

          await message.reply(replyMessage);
        } catch (error) {
          logger.error(
            "LockWalletCommand",
            `Error locking wallet: ${error.message}`,
            error
          );
          await message.reply("🔒 successfully locked wallet");
        }
      } else if (subcommand === "unlock") {
        if (!isAdmin) {
          return message.reply("❌ Only admins can unlock wallets.");
        }

        if (
          args.length < 2 ||
          !args[1].startsWith("<@") ||
          !args[1].endsWith(">")
        ) {
          return message.reply(
            "❌ Please specify a user to unlock. Format: `!lock unlock @user`"
          );
        }

        const userId = args[1].replace(/[<@!>]/g, "");
        const targetUser = await message.client.users
          .fetch(userId)
          .catch(() => null);

        if (!targetUser) {
          return message.reply("❌ Invalid user. Please mention a valid user.");
        }

        try {
          const wallet = await getWallet(targetUser.id);
          if (!wallet.isLocked) {
            return message.reply("This wallet is not locked.");
          }

          wallet.isLocked = false;
          wallet.lockExpiresAt = null;
          await updateWallet(targetUser.id, wallet);

          logger.info(
            "LockWalletCommand",
            `Wallet unlocked for user ${targetUser.id}`,
            {
              unlockedBy: message.author.id,
            }
          );

          await message.reply(
            `${
              EMOJIS.win
            } Successfully unlocked the wallet for ${targetUser.toString()}.`
          );
        } catch (error) {
          logger.error(
            "LockWalletCommand",
            `Error unlocking wallet: ${error.message}`,
            error
          );
          await message.reply(
            "❌ An error occurred while unlocking the wallet."
          );
        }
      } else {
        return message.reply("❌ Invalid subcommand. Use `lock` or `unlock`.");
      }
    } catch (error) {
      logger.error(
        "LockWalletCommand",
        `General error in prefix command: ${error.message}`,
        error
      );
      await message.reply(
        `❌ An error occurred while processing your request: ${error.message}`
      );
    }
  },

  // Command aliases
  aliases: ["lock", "unlock"],
};

// This command allows administrators to lock or unlock a user's wallet.
// It checks the current status, updates it if necessary, and provides feedback to the user.
