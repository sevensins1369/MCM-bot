// commands/viewwallet.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getWallet } = require("../utils/WalletManager");
const { formatAmount } = require("../utils/embedcreator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("viewwallet")
    .setDescription("View someone's wallet or your own.")
    .addUserOption((opt) => opt.setName("user").setDescription("Target user")),

  async execute(interaction) {
    try {
      const target = interaction.options.getUser("user") || interaction.user;
      console.log(
        `[EXECUTE] /viewwallet for ${target.tag} by ${interaction.user.tag}`
      );

      const executorIsAdmin =
        interaction.member.permissions.has("Administrator");

      if (target.bot) {
        return interaction.reply({
          content: "❌ Bots don't have wallets.",
          ephemeral: true,
        });
      }

      const wallet = await getWallet(target.id);

      if (
        target.id !== interaction.user.id &&
        wallet.isPrivate &&
        !executorIsAdmin
      ) {
        return interaction.reply({
          content: `❌ ${target.username}'s wallet is private.`,
          ephemeral: true,
        });
      }

      const { rs3, osrs } = wallet;

      const embed = new EmbedBuilder()
        .setColor(0x00bfff)
        .setTitle(`${target.username}'s Wallet`)
        .addFields(
          {
            name: "07 Balance:",
            value: `${formatAmount(osrs)} coins`,
            inline: true,
          },
          {
            name: "RS3 Balance:",
            value: `${formatAmount(rs3)} coins`,
            inline: true,
          }
        )
        .setThumbnail(target.displayAvatarURL())
        .setTimestamp()
        .setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in /viewwallet command:", error);
      const replyMethod =
        interaction.replied || interaction.deferred ? "followUp" : "reply";
      await interaction[replyMethod]({
        content: "❌ There was an error fetching the wallet.",
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      let target = message.author;

      // Check if a user was mentioned
      if (args.length > 0) {
        const userMention = args[0];
        const userId = userMention.replace(/[<@!>]/g, "");
        const mentionedUser = await message.client.users
          .fetch(userId)
          .catch(() => null);

        if (mentionedUser) {
          target = mentionedUser;
        }
      }

      console.log(
        `[RUN] !viewwallet for ${target.tag} by ${message.author.tag}`
      );

      const executorIsAdmin = message.member.permissions.has("Administrator");

      if (target.bot) {
        return message.reply("❌ Bots don't have wallets.");
      }

      const wallet = await getWallet(target.id);

      if (
        target.id !== message.author.id &&
        wallet.isPrivate &&
        !executorIsAdmin
      ) {
        return message.reply(`❌ ${target.username}'s wallet is private.`);
      }

      const { rs3, osrs } = wallet;

      const embed = new EmbedBuilder()
        .setColor(0x00bfff)
        .setTitle(`${target.username}'s Wallet`)
        .addFields(
          {
            name: "07 Balance:",
            value: `${formatAmount(osrs)} coins`,
            inline: true,
          },
          {
            name: "RS3 Balance:",
            value: `${formatAmount(rs3)} coins`,
            inline: true,
          }
        )
        .setThumbnail(target.displayAvatarURL())
        .setTimestamp()
        .setFooter({
          text: `Requested by ${message.author.username}`,
          iconURL: message.author.displayAvatarURL(),
        });

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in !viewwallet command:", error);
      await message.reply("❌ There was an error fetching the wallet.");
    }
  },
};

// This command allows users to view their wallet balances for RS3 and OSRS coins.
// It fetches the user's wallet from the database, formats the balances, and sends an embed
