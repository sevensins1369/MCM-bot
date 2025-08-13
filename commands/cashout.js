// commands/cashout.js
require("dotenv").config();
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { EMOJIS } = require("../utils/embedcreator");
const { logger } = require("../enhanced-logger");

const NOTIFICATION_CHANNEL_ID = process.env.CASH_IN_OUT_CHANNEL_ID;
const CASHIER_ROLE_ID = process.env.CASHIER_ROLE_ID;

// Track active requests
const activeRequests = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cashout")
    .setDescription("Notify staff that you would like to cash out.")
    .addStringOption((option) =>
      option
        .setName("amount")
        .setDescription("The amount you want to cash out (e.g., 100M, 1B)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("currency")
        .setDescription("The currency type")
        .setRequired(true)
        .addChoices(
          { name: "07", value: "osrs" },
          { name: "RS3", value: "RS3" },
          { name: "Other", value: "Other" }
        )
    ),

  async execute(interaction) {
    try {
      if (!NOTIFICATION_CHANNEL_ID) {
        return interaction.reply({
          content: "❌ This feature is not configured by the server admin.",
          ephemeral: true,
        });
      }

      const amount = interaction.options.getString("amount");
      const currency = interaction.options.getString("currency");

      logger.info(
        "CashOutCommand",
        `Cash out request from ${interaction.user.tag}`,
        {
          amount,
          currency,
        }
      );

      try {
        const notificationChannel = await interaction.client.channels.fetch(
          NOTIFICATION_CHANNEL_ID
        );

        const embed = new EmbedBuilder()
          .setColor(0xf00014)
          .setTitle(`${EMOJIS.stash} Cash Out Request`)
          .setDescription(`${interaction.user.toString()} wants to cash out.`)
          .addFields(
            { name: "Amount", value: amount, inline: true },
            { name: "Currency", value: currency, inline: true }
          )
          .setTimestamp()
          .setFooter({ text: `User ID: ${interaction.user.id}` });

        // Add claim button
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`claim_cashout_${interaction.user.id}`)
            .setLabel("Claim Request")
            .setStyle(ButtonStyle.Success)
        );

        // Add cashier ping if role ID is configured
        const pingText = CASHIER_ROLE_ID ? `<@&${CASHIER_ROLE_ID}>` : "";

        const message = await notificationChannel.send({
          content: pingText,
          embeds: [embed],
          components: [row],
        });

        // Store the request in the active requests map
        activeRequests.set(`claim_cashout_${interaction.user.id}`, {
          userId: interaction.user.id,
          messageId: message.id,
          type: "cashout",
          amount: amount,
          currency: currency,
          timestamp: Date.now(),
        });

        await interaction.reply({
          content:
            "✅ Staff has been notified, you will receive a DM when a cashier has accepted the request. please ensure you have DMs enabled to receive the message.",
          ephemeral: true,
        });

        logger.info(
          "CashOutCommand",
          `Cash out request notification sent for ${interaction.user.tag}`,
          {
            messageId: message.id,
          }
        );
      } catch (error) {
        logger.error(
          "CashOutCommand",
          `Error sending notification: ${error.message}`,
          error
        );
        return interaction.reply({
          content: `❌ An error occurred while sending your request: ${error.message}`,
          ephemeral: true,
        });
      }
    } catch (error) {
      logger.error("CashOutCommand", `General error: ${error.message}`, error);
      await interaction.reply({
        content: "❌ An error occurred while sending your request.",
        ephemeral: true,
      });
    }
  },

  // Button handler for claim button
  async handleButton(interaction) {
    try {
      const [_, type, userId] = interaction.customId.split("_");
      const requestKey = `claim_${type}_${userId}`;

      logger.info("CashOutCommand", `Button clicked: ${interaction.customId}`, {
        clickedBy: interaction.user.id,
      });

      // Check if the interaction has already been replied to or deferred
      const replyMethod =
        interaction.replied || interaction.deferred ? "followUp" : "reply";

      if (!activeRequests.has(requestKey)) {
        logger.warn(
          "CashOutCommand",
          `Request not found or expired: ${requestKey}`
        );
        return interaction[replyMethod]({
          content: "❌ This request has already been claimed or expired.",
          ephemeral: true,
        });
      }

      const request = activeRequests.get(requestKey);
      const cashierId = interaction.user.id;

      // Check if user has cashier role
      const isCashier = interaction.member.roles.cache.has(CASHIER_ROLE_ID);
      if (!isCashier) {
        logger.warn(
          "CashOutCommand",
          `Non-cashier attempted to claim request: ${interaction.user.tag}`
        );
        return interaction[replyMethod]({
          content:
            "❌ Only cashiers can claim requests. If you would like to become a cashier, please contact the server admin.",
          ephemeral: true,
        });
      }

      try {
        // Get the user who made the request
        const requestUser = await interaction.client.users.fetch(userId);

        // Update the embed to show it's been claimed
        const embed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0x000000)
          .setTitle(
            `${EMOJIS.stash} Cash Out Request (Claimed) you may now DM the requester!`
          )
          .addFields({
            name: "Claimed By",
            value: interaction.user.toString(),
          });

        // Disable the button
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`claimed_${requestKey}`)
            .setLabel(`Claimed by ${interaction.user.username}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );

        // Use editReply if the interaction was deferred, otherwise update
        if (interaction.deferred) {
          await interaction.editReply({
            embeds: [embed],
            components: [disabledRow],
          });
        } else {
          await interaction.update({
            embeds: [embed],
            components: [disabledRow],
          });
        }

        // DM the user
        try {
          await requestUser.send(
            `${
              EMOJIS.stash
            } Cashier ${interaction.user.toString()} will be ready to process your cash out request for **${
              request.amount
            } ${
              request.currency
            }** asap, please dm them to proceed or check message requests for their message. [warning: beware of impersonators, use the user tag from this message to verify they are the real cashier.]`
          );

          logger.info(
            "CashOutCommand",
            `DM sent to user about claimed request`,
            {
              userId,
              cashierId: interaction.user.id,
            }
          );
        } catch (dmError) {
          logger.error(
            "CashOutCommand",
            `Could not DM user: ${dmError.message}`,
            {
              userId,
              cashierId: interaction.user.id,
            }
          );

          await interaction.followUp({
            content: "⚠️ Could not DM the user. They may have DMs disabled.",
            ephemeral: true,
          });
        }

        // Remove from active requests
        activeRequests.delete(requestKey);

        logger.info("CashOutCommand", `Request successfully claimed`, {
          requestKey,
          claimedBy: interaction.user.id,
          requestDetails: request,
        });
      } catch (error) {
        logger.error(
          "CashOutCommand",
          `Error processing claim: ${error.message}`,
          error
        );
        return interaction.followUp({
          content: `❌ An error occurred while processing your claim: ${error.message}`,
          ephemeral: true,
        });
      }
    } catch (error) {
      logger.error(
        "CashOutCommand",
        `Error handling claim button: ${error.message}`,
        error
      );
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: "❌ An error occurred while processing your claim.",
            ephemeral: true,
          });
        } else {
          await interaction.followUp({
            content: "❌ An error occurred while processing your claim.",
            ephemeral: true,
          });
        }
      } catch (replyError) {
        logger.error(
          "CashOutCommand",
          `Failed to reply with error: ${replyError.message}`
        );
      }
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      if (!NOTIFICATION_CHANNEL_ID) {
        return message.reply(
          "❌ This feature is not configured by the server admin."
        );
      }

      if (args.length < 2) {
        return message.reply(
          "❌ Please specify an amount and currency. Usage: `!cashout <amount> <currency>`"
        );
      }

      const amount = args[0];
      const currency = args[1];

      logger.info(
        "CashOutCommand",
        `Cash out request from ${message.author.tag}`,
        {
          amount,
          currency,
        }
      );

      try {
        const notificationChannel = await message.client.channels.fetch(
          NOTIFICATION_CHANNEL_ID
        );

        const embed = new EmbedBuilder()
          .setColor(0xf00014)
          .setTitle(`${EMOJIS.stash} Cash Out Request`)
          .setDescription(`${message.author.toString()} wants to cash out.`)
          .addFields(
            { name: "Amount", value: amount, inline: true },
            { name: "Currency", value: currency, inline: true }
          )
          .setTimestamp()
          .setFooter({ text: `User ID: ${message.author.id}` });

        // Add claim button
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`claim_cashout_${message.author.id}`)
            .setLabel("Claim Request")
            .setStyle(ButtonStyle.Success)
        );

        // Add cashier ping if role ID is configured
        const pingText = CASHIER_ROLE_ID ? `<@&${CASHIER_ROLE_ID}>` : "";

        const notificationMsg = await notificationChannel.send({
          content: pingText,
          embeds: [embed],
          components: [row],
        });

        // Store the request in the active requests map
        activeRequests.set(`claim_cashout_${message.author.id}`, {
          userId: message.author.id,
          messageId: notificationMsg.id,
          type: "cashout",
          amount: amount,
          currency: currency,
          timestamp: Date.now(),
        });

        await message.reply(
          "✅ Staff has been notified, you will receive a DM when a cashier has accepted the request. please ensure you have DMs enabled to receive the message."
        );

        logger.info(
          "CashOutCommand",
          `Cash out request notification sent for ${message.author.tag}`,
          {
            messageId: notificationMsg.id,
          }
        );
      } catch (error) {
        logger.error(
          "CashOutCommand",
          `Error sending notification: ${error.message}`,
          error
        );
        return message.reply(
          `❌ An error occurred while sending your request: ${error.message}`
        );
      }
    } catch (error) {
      logger.error(
        "CashOutCommand",
        `General error in prefix command: ${error.message}`,
        error
      );
      await message.reply("❌ An error occurred while sending your request.");
    }
  },

  // Command aliases
  aliases: ["co"],
};

// This command allows users to notify staff that they want to cash out.
// It sends a message to a specified channel with the user's request and the amount they want to cash out.
