// commands/pot.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getDuel } = require("../utils/DuelManager");
const { formatAmount, EMOJIS } = require("../utils/embedcreator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pot")
    .setDescription("View all current bets on a duel")
    .addUserOption((option) =>
      option
        .setName("host")
        .setDescription("The host to check bets for (defaults to you)")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      // Get the target user (either the specified user or the command user)
      const targetUser =
        interaction.options.getUser("host") || interaction.user;
      console.log(
        `[EXECUTE] /pot for ${targetUser.tag} by ${interaction.user.tag}`
      );

      const duel = await getDuel(targetUser.id);
      if (!duel) {
        return interaction.editReply({
          content: `❌ ${targetUser.username} doesn't have an active duel.`,
        });
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(0xdaa520)
        .setTitle(`${EMOJIS.bet} Duel Bets for ${targetUser.username}`)
        .setDescription(
          `**Type:** ${duel.type.toUpperCase()} • **Status:** ${
            duel.isOpen ? "🟢 Open for betting" : "🔴 Closed for betting"
          }`
        )
        .setTimestamp();

      // Calculate totals
      let totalHostOsrs = 0n;
      let totalHostRs3 = 0n;
      let totalOpponentOsrs = 0n;
      let totalOpponentRs3 = 0n;

      // Group bets by side and currency
      const hostOsrsBets = [];
      const hostRs3Bets = [];
      const opponentOsrsBets = [];
      const opponentRs3Bets = [];

      for (const bet of duel.bets) {
        const betAmount = BigInt(bet.amount);
        const formattedAmount = formatAmount(betAmount);
        const betDisplay = `<@${bet.playerId}>: ${formattedAmount}`;

        if (bet.side === "host") {
          if (bet.currency === "osrs") {
            totalHostOsrs += betAmount;
            hostOsrsBets.push(betDisplay);
          } else {
            totalHostRs3 += betAmount;
            hostRs3Bets.push(betDisplay);
          }
        } else {
          if (bet.currency === "osrs") {
            totalOpponentOsrs += betAmount;
            opponentOsrsBets.push(betDisplay);
          } else {
            totalOpponentRs3 += betAmount;
            opponentRs3Bets.push(betDisplay);
          }
        }
      }

      // Add host bets fields
      if (hostOsrsBets.length > 0 || hostRs3Bets.length > 0) {
        embed.addFields({
          name: `${targetUser.username}'s Side`,
          value: `Total: ${formatAmount(totalHostOsrs)} OSRS, ${formatAmount(
            totalHostRs3
          )} RS3`,
          inline: false,
        });

        if (hostOsrsBets.length > 0) {
          embed.addFields({
            name: "OSRS Bets",
            value: hostOsrsBets.join("\n").slice(0, 1024) || "None",
            inline: true,
          });
        }

        if (hostRs3Bets.length > 0) {
          embed.addFields({
            name: "RS3 Bets",
            value: hostRs3Bets.join("\n").slice(0, 1024) || "None",
            inline: true,
          });
        }
      }

      // Add opponent bets fields
      if (opponentOsrsBets.length > 0 || opponentRs3Bets.length > 0) {
        // Try to get opponent's username
        let opponentName = "Opponent";
        if (duel.opponentId) {
          try {
            const opponent = await interaction.client.users.fetch(
              duel.opponentId
            );
            opponentName = opponent.username;
          } catch (error) {
            console.error("Error fetching opponent:", error);
          }
        }

        embed.addFields({
          name: `${opponentName}'s Side`,
          value: `Total: ${formatAmount(
            totalOpponentOsrs
          )} OSRS, ${formatAmount(totalOpponentRs3)} RS3`,
          inline: false,
        });

        if (opponentOsrsBets.length > 0) {
          embed.addFields({
            name: "OSRS Bets",
            value: opponentOsrsBets.join("\n").slice(0, 1024) || "None",
            inline: true,
          });
        }

        if (opponentRs3Bets.length > 0) {
          embed.addFields({
            name: "RS3 Bets",
            value: opponentRs3Bets.join("\n").slice(0, 1024) || "None",
            inline: true,
          });
        }
      }

      // Add total pot value
      const totalOsrs = totalHostOsrs + totalOpponentOsrs;
      const totalRs3 = totalHostRs3 + totalOpponentRs3;

      embed.addFields({
        name: "Total Pot",
        value: `${formatAmount(totalOsrs)} OSRS, ${formatAmount(totalRs3)} RS3`,
        inline: false,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in /pot command:", error);
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: `❌ An error occurred while fetching the pot.`,
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      // Get the target user (either the mentioned user or the command user)
      let targetUser = message.author;

      if (args.length > 0) {
        const userMention = args[0];
        const userId = userMention.replace(/[<@!>]/g, "");
        const mentionedUser = await message.client.users
          .fetch(userId)
          .catch(() => null);

        if (mentionedUser) {
          targetUser = mentionedUser;
        }
      }

      console.log(`[RUN] !pot for ${targetUser.tag} by ${message.author.tag}`);

      const duel = await getDuel(targetUser.id);
      if (!duel) {
        return message.reply(
          `❌ ${targetUser.username} doesn't have an active duel.`
        );
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(0xdaa520)
        .setTitle(`${EMOJIS.bet} Duel Bets for ${targetUser.username}`)
        .setDescription(
          `**Type:** ${duel.type.toUpperCase()} • **Status:** ${
            duel.isOpen ? "🟢 Open for betting" : "🔴 Closed for betting"
          }`
        )
        .setTimestamp();

      // Calculate totals
      let totalHostOsrs = 0n;
      let totalHostRs3 = 0n;
      let totalOpponentOsrs = 0n;
      let totalOpponentRs3 = 0n;

      // Group bets by side and currency
      const hostOsrsBets = [];
      const hostRs3Bets = [];
      const opponentOsrsBets = [];
      const opponentRs3Bets = [];

      for (const bet of duel.bets) {
        const betAmount = BigInt(bet.amount);
        const formattedAmount = formatAmount(betAmount);
        const betDisplay = `<@${bet.playerId}>: ${formattedAmount}`;

        if (bet.side === "host") {
          if (bet.currency === "osrs") {
            totalHostOsrs += betAmount;
            hostOsrsBets.push(betDisplay);
          } else {
            totalHostRs3 += betAmount;
            hostRs3Bets.push(betDisplay);
          }
        } else {
          if (bet.currency === "osrs") {
            totalOpponentOsrs += betAmount;
            opponentOsrsBets.push(betDisplay);
          } else {
            totalOpponentRs3 += betAmount;
            opponentRs3Bets.push(betDisplay);
          }
        }
      }

      // Add host bets fields
      if (hostOsrsBets.length > 0 || hostRs3Bets.length > 0) {
        embed.addFields({
          name: `${targetUser.username}'s Side`,
          value: `Total: ${formatAmount(totalHostOsrs)} OSRS, ${formatAmount(
            totalHostRs3
          )} RS3`,
          inline: false,
        });

        if (hostOsrsBets.length > 0) {
          embed.addFields({
            name: "OSRS Bets",
            value: hostOsrsBets.join("\n").slice(0, 1024) || "None",
            inline: true,
          });
        }

        if (hostRs3Bets.length > 0) {
          embed.addFields({
            name: "RS3 Bets",
            value: hostRs3Bets.join("\n").slice(0, 1024) || "None",
            inline: true,
          });
        }
      }

      // Add opponent bets fields
      if (opponentOsrsBets.length > 0 || opponentRs3Bets.length > 0) {
        // Try to get opponent's username
        let opponentName = "Opponent";
        if (duel.opponentId) {
          try {
            const opponent = await message.client.users.fetch(duel.opponentId);
            opponentName = opponent.username;
          } catch (error) {
            console.error("Error fetching opponent:", error);
          }
        }

        embed.addFields({
          name: `${opponentName}'s Side`,
          value: `Total: ${formatAmount(
            totalOpponentOsrs
          )} OSRS, ${formatAmount(totalOpponentRs3)} RS3`,
          inline: false,
        });

        if (opponentOsrsBets.length > 0) {
          embed.addFields({
            name: "OSRS Bets",
            value: opponentOsrsBets.join("\n").slice(0, 1024) || "None",
            inline: true,
          });
        }

        if (opponentRs3Bets.length > 0) {
          embed.addFields({
            name: "RS3 Bets",
            value: opponentRs3Bets.join("\n").slice(0, 1024) || "None",
            inline: true,
          });
        }
      }

      // Add total pot value
      const totalOsrs = totalHostOsrs + totalOpponentOsrs;
      const totalRs3 = totalHostRs3 + totalOpponentRs3;

      embed.addFields({
        name: "Total Pot",
        value: `${formatAmount(totalOsrs)} OSRS, ${formatAmount(totalRs3)} RS3`,
        inline: false,
      });

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in !pot command:", error);
      await message.reply(`❌ An error occurred while fetching the pot.`);
    }
  },

  // Command aliases
  aliases: ["p"],
};
