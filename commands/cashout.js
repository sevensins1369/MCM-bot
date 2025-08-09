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

const NOTIFICATION_CHANNEL_ID = process.env.CASH_IN_OUT_CHANNEL_ID;
const CASHIER_ROLE_ID = process.env.CASHIER_ROLE_ID;

// Track active requests
const activeRequests = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cashout")
    .setDescription(
      "Notify staff that you would like to cash out your balance."
    )
    .addStringOption((option) =>
      option
        .setName("amount")
        .setDescription(
          "The amount and type of currency (e.g., 100M 07, 1B RS3)."
        )
        .setRequired(true)
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
      const notificationChannel = await interaction.client.channels.fetch(
        NOTIFICATION_CHANNEL_ID
      );

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${EMOJIS.loss} Cash Out Request`)
        .setDescription(`${interaction.user.toString()} wants to cash out.`)
        .addFields({ name: "Amount", value: amount })
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
        timestamp: Date.now(),
      });

      await interaction.reply({
        content:
          "✅ The staff has been notified of your cash out request. They will contact you shortly.",
        ephemeral: true,
      });
    } catch (error) {
      console.error("Error in /cashout command:", error);
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

      if (!activeRequests.has(requestKey)) {
        return interaction.reply({
          content: "❌ This request has already been claimed or expired.",
          ephemeral: true,
        });
      }

      const request = activeRequests.get(requestKey);
      const cashierId = interaction.user.id;

      // Check if user has cashier role
      const isCashier = interaction.member.roles.cache.has(CASHIER_ROLE_ID);
      if (!isCashier) {
        return interaction.reply({
          content: "❌ Only cashiers can claim requests.",
          ephemeral: true,
        });
      }

      // Get the user who made the request
      const requestUser = await interaction.client.users.fetch(userId);

      // Update the embed to show it's been claimed
      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0x3498db)
        .setTitle(`${EMOJIS.loss} Cash Out Request (Claimed)`)
        .addFields({ name: "Claimed By", value: interaction.user.toString() });

      // Disable the button
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`claimed_${requestKey}`)
          .setLabel(`Claimed by ${interaction.user.username}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );

      await interaction.update({ embeds: [embed], components: [disabledRow] });

      // DM the user
      try {
        await requestUser.send(
          `${
            EMOJIS.loss
          } Cashier ${interaction.user.toString()} will be ready to process your cash out request for **${
            request.amount
          }** in the cash in/out channel in just a moment!`
        );
      } catch (dmError) {
        console.error("Could not DM user:", dmError);
        await interaction.followUp({
          content: "⚠️ Could not DM the user. They may have DMs disabled.",
          ephemeral: true,
        });
      }

      // Remove from active requests
      activeRequests.delete(requestKey);
    } catch (error) {
      console.error("Error handling claim button:", error);
      await interaction.reply({
        content: "❌ An error occurred while processing your claim.",
        ephemeral: true,
      });
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

      if (args.length < 1) {
        return message.reply(
          "❌ Please specify an amount. Usage: `!cashout <amount>`"
        );
      }

      const amount = args.join(" ");
      const notificationChannel = await message.client.channels.fetch(
        NOTIFICATION_CHANNEL_ID
      );

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${EMOJIS.loss} Cash Out Request`)
        .setDescription(`${message.author.toString()} wants to cash out.`)
        .addFields({ name: "Amount", value: amount })
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
        timestamp: Date.now(),
      });

      await message.reply(
        "✅ The staff has been notified of your cash out request. They will contact you shortly."
      );
    } catch (error) {
      console.error("Error in !cashout command:", error);
      await message.reply("❌ An error occurred while sending your request.");
    }
  },
};

// This command allows users to notify staff that they want to cash out.
// It sends a message to a specified channel with the user's request and the amount they want to cash out.
