// commands/dicepot.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getActiveDiceGame } = require("../utils/DiceManager");
const { EMOJIS, formatAmount } = require("../utils/embedcreator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dicepot")
    .setDescription("View all current bets on a host's dicing table.")
    .addUserOption((option) =>
      option
        .setName("host")
        .setDescription("The host running the dicing table.")
        .setRequired(true)
    ),

  // The 'interaction' parameter is defined here for the entire function's scope
  async execute(interaction) {
    // The try...catch block is placed inside the function,
    // so 'interaction' will be available to both the 'try' and 'catch' parts.
    try {
      await interaction.deferReply();
      const host = interaction.options.getUser("host");
      console.log(
        `[EXECUTE] /dicepot for ${host.tag} by ${interaction.user.tag}`
      );

      const game = getActiveDiceGame(host.id);
      if (!game) {
        return interaction.editReply({
          content: `❌ ${host.username} does not have an active dicing table.`,
        });
      }

      if (!game.bets || game.bets.length === 0) {
        return interaction.editReply({
          content: `${host.username}'s dicing table has no active bets.`,
        });
      }

      const betsByType = {};
      let totalBets = 0;
      let totalAmountOsrs = 0n;
      let totalAmountRs3 = 0n;

      for (const bet of game.bets) {
        totalBets++;
        const betAmount = BigInt(bet.amount);
        if (bet.currency === "osrs") totalAmountOsrs += betAmount;
        if (bet.currency === "rs3") totalAmountRs3 += betAmount;

        const betTypeName =
          bet.betOn === "number"
            ? `Number (${bet.specificNumber})`
            : bet.betOn.charAt(0).toUpperCase() + bet.betOn.slice(1);
        if (!betsByType[betTypeName]) {
          betsByType[betTypeName] = [];
        }
        betsByType[betTypeName].push(
          `<@${bet.playerId}>: ${formatAmount(betAmount)}`
        );
      }

      const embed = new EmbedBuilder()
        .setColor(0xdaa520)
        .setTitle(`${EMOJIS.dice} Dicing Table Bets for ${host.username}`)
        .setDescription(
          `**Total Bets:** ${totalBets}\n**07 Pot:** ${formatAmount(
            totalAmountOsrs
          )}\n**RS3 Pot:** ${formatAmount(totalAmountRs3)}`
        )
        .setTimestamp();

      for (const [betType, bets] of Object.entries(betsByType)) {
        embed.addFields({
          name: `${EMOJIS.bet} ${betType}`,
          value: bets.join("\n").slice(0, 1024),
          inline: true,
        });
      }

      // This is the line the user mentioned (around line 65)
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in /dicepot command:", error);

      // Because 'interaction' is a parameter of the 'execute' function,
      // it is guaranteed to be defined and accessible here in the 'catch' block.
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: `❌ An error occurred while fetching the dice pot.`,
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      if (args.length < 1) {
        return message.reply(
          "❌ Please specify a host. Usage: `!dicepot <host>`"
        );
      }

      const hostMention = args[0];
      const hostId = hostMention.replace(/[<@!>]/g, "");
      const host = await message.client.users.fetch(hostId).catch(() => null);

      if (!host) {
        return message.reply("❌ Invalid host. Please mention a valid user.");
      }

      console.log(`[RUN] !dicepot for ${host.tag} by ${message.author.tag}`);

      const game = getActiveDiceGame(host.id);
      if (!game) {
        return message.reply(
          `❌ ${host.username} does not have an active dicing table.`
        );
      }

      if (!game.bets || game.bets.length === 0) {
        return message.reply(
          `${host.username}'s dicing table has no active bets.`
        );
      }

      const betsByType = {};
      let totalBets = 0;
      let totalAmountOsrs = 0n;
      let totalAmountRs3 = 0n;

      for (const bet of game.bets) {
        totalBets++;
        const betAmount = BigInt(bet.amount);
        if (bet.currency === "osrs") totalAmountOsrs += betAmount;
        if (bet.currency === "rs3") totalAmountRs3 += betAmount;

        const betTypeName =
          bet.betOn === "number"
            ? `Number (${bet.specificNumber})`
            : bet.betOn.charAt(0).toUpperCase() + bet.betOn.slice(1);
        if (!betsByType[betTypeName]) {
          betsByType[betTypeName] = [];
        }
        betsByType[betTypeName].push(
          `<@${bet.playerId}>: ${formatAmount(betAmount)}`
        );
      }

      const embed = new EmbedBuilder()
        .setColor(0xdaa520)
        .setTitle(`${EMOJIS.dice} Dicing Table Bets for ${host.username}`)
        .setDescription(
          `**Total Bets:** ${totalBets}\n**07 Pot:** ${formatAmount(
            totalAmountOsrs
          )}\n**RS3 Pot:** ${formatAmount(totalAmountRs3)}`
        )
        .setTimestamp();

      for (const [betType, bets] of Object.entries(betsByType)) {
        embed.addFields({
          name: `${EMOJIS.bet} ${betType}`,
          value: bets.join("\n").slice(0, 1024),
          inline: true,
        });
      }

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in !dicepot command:", error);
      await message.reply(`❌ An error occurred while fetching the dice pot.`);
    }
  },
};

// This command allows users to view all current bets on a host's dicing table.
