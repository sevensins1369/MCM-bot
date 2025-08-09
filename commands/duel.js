// commands/duel.js
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const {
  createDuel,
  getDuel,
  setDuelMessage,
  toggleDuelBetting,
} = require("../utils/DuelManager");
const { createDuelEmbed, EMOJIS } = require("../utils/embedcreator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("duel")
    .setDescription("Start a new duel or toggle betting status (Hosts only).")
    .addStringOption((opt) =>
      opt
        .setName("type")
        .setDescription("Type of duel (only for new duels)")
        .setRequired(false)
        .addChoices(
          { name: "Whip", value: "whip" },
          { name: "Poly", value: "poly" }
        )
    )
    .addUserOption((opt) =>
      opt
        .setName("opponent")
        .setDescription("The opponent for the duel")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      console.log(`[EXECUTE] /duel by ${interaction.user.tag}`);

      const user = interaction.user;
      const member = interaction.member;
      const isHost = member.roles.cache.some(
        (role) =>
          role.name.toLowerCase() === "host" ||
          role.name.toLowerCase() === "duel host" ||
          role.id === process.env.HOST_ROLE_ID
      );
      const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

      if (!isHost && !isAdmin) {
        return interaction.editReply({
          content: "❌ Only duel hosts can use this command.",
          ephemeral: true,
        });
      }

      const existingDuel = await getDuel(user.id);

      if (existingDuel && existingDuel.success !== false) {
        const result = await toggleDuelBetting(user.id);
        if (!result.success) {
          return interaction.editReply({
            content: `❌ Error: ${result.message}`,
            ephemeral: true,
          });
        }

        let confirmationMessage;
        if (result.isOpen) {
          confirmationMessage = `${EMOJIS.bet} Betting is now OPEN for your ${existingDuel.type} duel.`;
        } else {
          confirmationMessage = `${EMOJIS.closed} Betting is now CLOSED for your ${existingDuel.type} duel.`;
        }

        const embed = await createDuelEmbed(
          existingDuel,
          user,
          interaction.client
        );

        if (existingDuel.messageId && existingDuel.channelId) {
          try {
            const channel = await interaction.client.channels.fetch(
              existingDuel.channelId
            );
            const message = await channel.messages.fetch(
              existingDuel.messageId
            );
            await message.edit({
              content: confirmationMessage,
              embeds: [embed],
            });
          } catch (error) {
            console.error("Error updating duel message:", error);
          }
        }

        await interaction.editReply({ content: confirmationMessage });
        console.log(
          `${user.username} toggled betting for their ${existingDuel.type} duel.`
        );
      } else {
        const duelType = interaction.options.getString("type");
        const opponent = interaction.options.getUser("opponent");

        if (!duelType) {
          return interaction.editReply({
            content: "❌ You must specify a duel type to create a new duel.",
          });
        }

        // Validate opponent if provided
        if (opponent) {
          if (opponent.id === user.id) {
            return interaction.editReply({
              content: "❌ You cannot duel yourself.",
            });
          }

          // Check if opponent is a host
          const opponentMember = await interaction.guild.members
            .fetch(opponent.id)
            .catch(() => null);
          if (!opponentMember) {
            return interaction.editReply({
              content: "❌ Could not find the opponent in this server.",
            });
          }

          const isOpponentHost = opponentMember.roles.cache.some(
            (role) =>
              role.name.toLowerCase() === "host" ||
              role.name.toLowerCase() === "duel host" ||
              role.id === process.env.HOST_ROLE_ID
          );

          if (
            !isOpponentHost &&
            !opponentMember.permissions.has(PermissionFlagsBits.Administrator)
          ) {
            return interaction.editReply({
              content:
                "❌ The opponent must be a host to participate in duels.",
            });
          }

          // Check if opponent already has an active duel
          const opponentDuel = await getDuel(opponent.id);
          if (opponentDuel && opponentDuel.success !== false) {
            return interaction.editReply({
              content: `❌ ${opponent.username} already has an active duel.`,
            });
          }
        }

        const result = await createDuel(
          user.id,
          duelType,
          opponent ? opponent.id : null
        );
        if (!result.success) {
          return interaction.editReply({
            content: `❌ Error: ${result.message}`,
            ephemeral: true,
          });
        }

        const duel = result.duel;
        const embed = await createDuelEmbed(duel, user, interaction.client);

        const publicReply = await interaction.editReply({
          content: `${
            EMOJIS.stash
          } *"An offer he can't refuse."* - New ${duelType} duel open!${
            opponent ? ` ${user.username} vs ${opponent.username}` : ""
          }`,
          embeds: [embed],
        });

        await setDuelMessage(user.id, publicReply.id, interaction.channelId);
        console.log(
          `${user.username} started a new ${duelType} duel${
            opponent ? ` against ${opponent.username}` : ""
          }.`
        );
      }
    } catch (error) {
      console.error("Error in /duel command:", error);
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: "❌ An error occurred.",
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      console.log(`[RUN] !duel by ${message.author.tag}`);

      const user = message.author;
      const member = message.member;
      const isHost = member.roles.cache.some(
        (role) =>
          role.name.toLowerCase() === "host" ||
          role.name.toLowerCase() === "duel host" ||
          role.id === process.env.HOST_ROLE_ID
      );
      const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

      if (!isHost && !isAdmin) {
        return message.reply("❌ Only duel hosts can use this command.");
      }

      const existingDuel = await getDuel(user.id);

      if (existingDuel && existingDuel.success !== false && args.length === 0) {
        // Toggle betting if no arguments and duel exists
        const result = await toggleDuelBetting(user.id);
        if (!result.success) {
          return message.reply(`❌ Error: ${result.message}`);
        }

        let confirmationMessage;
        if (result.isOpen) {
          confirmationMessage = `${EMOJIS.bet} Betting is now OPEN for your ${existingDuel.type} duel.`;
        } else {
          confirmationMessage = `${EMOJIS.closed} Betting is now CLOSED for your ${existingDuel.type} duel.`;
        }

        const embed = await createDuelEmbed(existingDuel, user, message.client);

        if (existingDuel.messageId && existingDuel.channelId) {
          try {
            const channel = await message.client.channels.fetch(
              existingDuel.channelId
            );
            const duelMessage = await channel.messages.fetch(
              existingDuel.messageId
            );
            await duelMessage.edit({
              content: confirmationMessage,
              embeds: [embed],
            });
          } catch (error) {
            console.error("Error updating duel message:", error);
          }
        }

        await message.reply(confirmationMessage);
        console.log(
          `${user.username} toggled betting for their ${existingDuel.type} duel.`
        );
      } else {
        // Create new duel
        const duelType = args[0]?.toLowerCase();
        if (!duelType || (duelType !== "whip" && duelType !== "poly")) {
          return message.reply(
            "❌ You must specify a valid duel type (whip or poly) to create a new duel."
          );
        }

        // Check for opponent mention
        let opponent = null;
        if (args.length > 1) {
          const opponentMention = args[1];
          const opponentId = opponentMention.replace(/[<@!>]/g, "");
          opponent = await message.client.users
            .fetch(opponentId)
            .catch(() => null);

          if (!opponent) {
            return message.reply(
              "❌ Invalid opponent. Please mention a valid user."
            );
          }

          if (opponent.id === user.id) {
            return message.reply("❌ You cannot duel yourself.");
          }

          // Check if opponent is a host
          const opponentMember = await message.guild.members
            .fetch(opponent.id)
            .catch(() => null);
          if (!opponentMember) {
            return message.reply(
              "❌ Could not find the opponent in this server."
            );
          }

          const isOpponentHost = opponentMember.roles.cache.some(
            (role) =>
              role.name.toLowerCase() === "host" ||
              role.name.toLowerCase() === "duel host" ||
              role.id === process.env.HOST_ROLE_ID
          );

          if (
            !isOpponentHost &&
            !opponentMember.permissions.has(PermissionFlagsBits.Administrator)
          ) {
            return message.reply(
              "❌ The opponent must be a host to participate in duels."
            );
          }

          // Check if opponent already has an active duel
          const opponentDuel = await getDuel(opponent.id);
          if (opponentDuel && opponentDuel.success !== false) {
            return message.reply(
              `❌ ${opponent.username} already has an active duel.`
            );
          }
        }

        const result = await createDuel(
          user.id,
          duelType,
          opponent ? opponent.id : null
        );
        if (!result.success) {
          return message.reply(`❌ Error: ${result.message}`);
        }

        const duel = result.duel;
        const embed = await createDuelEmbed(duel, user, message.client);

        const publicReply = await message.channel.send({
          content: `${
            EMOJIS.stash
          } *"An offer he can't refuse."* - New ${duelType} duel open!${
            opponent ? ` ${user.username} vs ${opponent.username}` : ""
          }`,
          embeds: [embed],
        });

        await setDuelMessage(user.id, publicReply.id, message.channel.id);
        console.log(
          `${user.username} started a new ${duelType} duel${
            opponent ? ` against ${opponent.username}` : ""
          }.`
        );
      }
    } catch (error) {
      console.error("Error in !duel command:", error);
      await message.reply("❌ An error occurred.");
    }
  },
};
