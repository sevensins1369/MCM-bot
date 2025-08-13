// commands/commands.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { EMOJIS } = require("../utils/embedcreator");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("commands")
    .setDescription("Shows a list of available commands."),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      // Check if user is admin or host
      const isAdmin = interaction.memberPermissions.has("Administrator");
      const isHost = interaction.member.roles.cache.has(
        process.env.HOST_ROLE_ID
      );

      // Create embeds
      const generalEmbed = new EmbedBuilder()
        .setColor(0x4caf50)
        .setTitle(`${EMOJIS.stash} General Commands`)
        .addFields(
          {
            name: "Wallet Commands",
            value:
              "• `/wallet` or  `.bal` - View your wallet\n" +
              "• `/viewwallet` or `.view <user>` - View another user wallet\n" +
              "• `/send` or `.send <user> <amount> <currency>` - Send balance to a user\n" +
              "• `/swap` or `.swap <direction> <amount>` - Swap between osrs and RS3 currencies\n" +
              "• `/lock-wallet` or `.lock [duration]` - Lock/unlock wallet\n" +
              "• `/set-default` or `.default <currency>` - Set wallet default osrs or rs3\n" +
              "• `/wallet-privacy` or `.privacy <status>` - Set wallet privacy",
          },
          {
            name: "Utility Commands",
            value:
              "• `/donate` or `.donate <amount> <currency>` - Donate to the server!\n" +
              "• `/cashin` or `.cashin <amount>` - Request to cash in\n" +
              "• `/cashout` or `.cashout <amount>` - Request to cash out",
          }
        );

      const leaderboardEmbed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(`${EMOJIS.diamond} Leaderboard Commands`)
        .addFields(
          {
            name: "Leaderboard Commands",
            value:
              "• `/leaderboard-07` or `.lbosrs <timeframe> <category>` - View osrs leaderboard\n" +
              "• `/leaderboard-rs3` or `.lbrs3 <timeframe> <category>` - View RS3 leaderboard\n" +
              "• `/donator-leaderboard` or `.donators` - View top donators\n" +
              "• `/flower-leaderboard` or `.flb <currency> <timeframe> <category>` - View flower games leaderboard\n" +
              "• `/diceduel-leaderboard` or `.ddlb <currency> <timeframe> <category>` - View dice duel leaderboard",
          },
          {
            name: "Stats Commands",
            value:
              "• `/mystats` or `.ms` - View your gambling stats\n" +
              "• `/daily` or `.daily` - View daily stats\n" +
              "• `/weekly` or `.weekly` - View weekly stats\n" +
              "• `/monthly` or `.monthly` - View monthly stats",
          }
        );

      const bettingEmbed = new EmbedBuilder()
        .setColor(0xf44336)
        .setTitle(`${EMOJIS.bet} Game Commands`)
        .addFields(
          {
            name: "Duels",
            value:
              "• `/bet` or `.bet <host> <amount> <currency> <duel_type>` - Place a bet on a duel\n" +
              "• `/duel-streak` or `.streak [user]` - View duel win streaks\n" +
              "• `/pot` or `.pot [user]` - View all bets on your duel",
          },
          {
            name: "Dicing/diceduel",
            value:
              "• `/dice-duel` or `.diceduel <opponent> <amount> <currency>` - Challenge someone to a dice duel\n" +
              "• `/diceduel-cancel` or `.ddc` - Cancel your active dice duel\n" +
              "• `/roll` or `.roll` - roll the dice for diceduel\n" +
              "• `/dice` or `.dice <host> <amount> <currency> <bet_on>` - Place a dice bet\n" +
              "• `/dicing-streak` or `.dices [user]` - View dicing streaks\n" +
              "• `/dicepot` or `.dp <host>` - View all bets on a host's dice table",
          },
          {
            name: "Flowergames",
            value:
              "• `/flowerbet` or `.fb <host> <amount> <currency> <bet_type>` - Place a flowerGame bet",
          },
          {
            name: "hot/cold",
            value:
              "• `/hotcoldbet` or `.hcbet <user> <bet_type> <amount>` - place a hot/cold bet\n" +
              "• `/hotcoldpot` or `.hcpot <user>` - View all bets on a host's hot/cold pot",
          },
          {
            name: "misc",
            value:
              "• `/request-host` or `.hosting` - Request a host\n" +
              "• `/request-refund` or `.ref <host>` - Request a refund\n" +
              "• `/mybets` or `.mybets` - View your active bets",
          }
        );

      const hostEmbed = new EmbedBuilder()
        .setColor(0x2196f3)
        .setTitle(`${EMOJIS.host} Host Commands`)
        .addFields(
          {
            name: "Duel Hosting",
            value:
              "• `/duel` or `.duel <type> [user]` - Start a new duel (Whip or Poly)\n" +
              "• `/win` or `.win` - Declare a win and process payouts\n" +
              "• `/loss` or `.loss` - Declare a loss\n" +
              "• `/pot` or `.pot` - View all bets on your duel\n" +
              "• `/cancelduel` or `.cancelduel` - Cancel your duel and refund all bets",
          },
          {
            name: "Dice Hosting",
            value:
              "• `/dicetable <subcommand>` - Manage your dice table\n" +
              "• `.dopen` - Open a dice table\n" +
              "• `.dclose` - Close a dice table\n" +
              "• `.dtoggle` - Toggle betting open/closed\n" +
              "• `/rollresult` or `.rr <roll>` - Enter your dice roll result",
          },
          {
            name: "Flower Hosting",
            value:
              "• `/flowergame` or `.fg <subcommand> [type]` - Start a flower game\n" +
              "• `/set-flowers` or `.sf` - Set the flowergames results",
          },
          {
            name: "hot/cold hosting",
            value:
              "• `/hotcold` or `.hc` - start a hot/cold game\n" +
              "• `/hotcoldhistory` or `.hch` - View the streak history for hot/cold games\n" +
              "• `/hotcoldresult` or `.hcr <result>` - Set the result of a hot/cold game",
          },
          {
            name: "misc",
            value:
              "• `/host-leaderboard` or `.hl <currency> <category>` - View host leaderboard\n" +
              "• `/hoststatus` or `.hs <subcommand>` - Set your hosting status open/closed\n" +
              "• `/universal-refund` or `.refund <player>` - Refund a player's bets across all game modes\n" +
              "• `/placebet` or `.pb <player> <host> <currency> <amount> <duel_type>` - Place a bet on behalf of a player\n" +
              "• `/set-twitch` or `.twitch <username>` - Set your Twitch username for host embeds",
          }
        );

      const adminEmbed = new EmbedBuilder()
        .setColor(0x9c27b0)
        .setTitle(`${EMOJIS.don} Admin Commands`)
        .addFields(
          {
            name: "Wallet Management",
            value:
              "• `/setwallet` or `.set <user> <currency> <amount>` - Set a user's wallet balance\n" +
              "• `/server-wallet` or `.sw [subcommand]` - Manage the server wallet",
          },
          {
            name: "Server Management",
            value:
              "• `/trigger <subcommand> [name] [response]` or `!trigger <subcommand> [name] [response]` - Manage custom text triggers\n" +
              "• `/adminfixstats or `.fix` - Fix stats for a hosts streak if they are incorrect",
          }
        );

      // Create pagination buttons
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("cmd_general")
          .setLabel("General")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("cmd_leaderboard")
          .setLabel("Leaderboards")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("cmd_betting")
          .setLabel("betting")
          .setStyle(ButtonStyle.Primary)
      );

      // Add host button only if user is host or admin
      if (isHost || isAdmin) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId("cmd_host")
            .setLabel("Host")
            .setStyle(ButtonStyle.Primary)
        );
      }

      // Add admin button only if user is admin
      if (isAdmin) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId("cmd_admin")
            .setLabel("Admin")
            .setStyle(ButtonStyle.Danger)
        );
      }

      // Start with general commands
      await interaction.editReply({
        embeds: [generalEmbed],
        components: [row],
      });

      // Create collector for button interactions
      const filter = (i) =>
        i.customId.startsWith("cmd_") && i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({
        filter,
        time: 300000,
      }); // 5 minutes

      collector.on("collect", async (i) => {
        try {
          // Determine which embed to show based on button clicked
          let embedToShow;
          switch (i.customId) {
            case "cmd_general":
              embedToShow = generalEmbed;
              break;
            case "cmd_leaderboard":
              embedToShow = leaderboardEmbed;
              break;
            case "cmd_betting":
              embedToShow = bettingEmbed;
              break;
            case "cmd_host":
              if (isHost || isAdmin) {
                embedToShow = hostEmbed;
              } else {
                embedToShow = generalEmbed;
              }
              break;
            case "cmd_admin":
              if (isAdmin) {
                embedToShow = adminEmbed;
              } else {
                embedToShow = generalEmbed;
              }
              break;
            default:
              embedToShow = generalEmbed;
          }

          await i.update({ embeds: [embedToShow], components: [row] });
        } catch (error) {
          console.error("Error handling button interaction:", error);
        }
      });

      collector.on("end", async () => {
        try {
          // Remove buttons when collector expires
          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("cmd_expired")
              .setLabel("Command List Expired")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          );

          await interaction.editReply({ components: [disabledRow] });
        } catch (error) {
          console.error("Error disabling buttons:", error);
        }
      });
    } catch (error) {
      console.error("Error in /commands command:", error);
      const replyMethod =
        interaction.replied || interaction.deferred ? "editReply" : "reply";
      await interaction[replyMethod]({
        content: "❌ An error occurred while fetching the commands list.",
        ephemeral: true,
      });
    }
  },

  // For prefix command usage
  async run(message, args) {
    try {
      // Check if user is admin or host
      const isAdmin = message.member.permissions.has("Administrator");
      const isHost = message.member.roles.cache.has(process.env.HOST_ROLE_ID);

      // Create embeds - same as in the execute function
      const generalEmbed = new EmbedBuilder()
        .setColor(0x4caf50)
        .setTitle(`${EMOJIS.stash} General Commands`)
        .addFields(
          {
            name: "Wallet Commands",
            value:
              "• `/wallet` or  `.bal` - View your wallet\n" +
              "• `/viewwallet` or `.view <user>` - View another user wallet\n" +
              "• `/send` or `.send <user> <amount> <currency>` - Send balance to a user\n" +
              "• `/swap` or `.swap <direction> <amount>` - Swap between osrs and RS3 currencies\n" +
              "• `/lock-wallet` or `lock [duration]` - Lock/unlock wallet\n" +
              "• `/set-default` or `.default <currency>` - Set wallet default osrs or rs3\n" +
              "• `/wallet-privacy` or `.privacy <status>` - Set wallet privacy",
          },
          {
            name: "Utility Commands",
            value:
              "• `/donate` or `.donate <amount> <currency>` - Donate to the server!\n" +
              "• `/cashin` or `.cashin <amount>` - Request to cash in\n" +
              "• `/cashout` or `.cashout <amount>` - Request to cash out",
          }
        );

      const leaderboardEmbed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(`${EMOJIS.diamond} Leaderboard Commands`)
        .addFields(
          {
            name: "Leaderboard Commands",
            value:
              "• `/leaderboard-07` or `.lbosrs <timeframe> <category>` - View osrs leaderboard\n" +
              "• `/leaderboard-rs3` or `.lbrs3 <timeframe> <category>` - View RS3 leaderboard\n" +
              "• `/donator-leaderboard` or `.donators` - View top donators\n" +
              "• `/flower-leaderboard` or `.flb <currency> <timeframe> <category>` - View flower games leaderboard\n" +
              "• `/diceduel-leaderboard` or `.ddlb <currency> <timeframe> <category>` - View dice duel leaderboard",
          },
          {
            name: "Stats Commands",
            value:
              "• `/mystats` or `.ms` - View your gambling stats\n" +
              "• `/daily` or `.daily` - View daily stats\n" +
              "• `/weekly` or `.weekly` - View weekly stats\n" +
              "• `/monthly` or `.monthly` - View monthly stats",
          }
        );

      const bettingEmbed = new EmbedBuilder()
        .setColor(0xf44336)
        .setTitle(`${EMOJIS.bet} Game Commands`)
        .addFields(
          {
            name: "Duels",
            value:
              "• `/bet` or `.b <host> <amount> <currency/skip if default> <whip/poly>` - Place a bet on a duel\n" +
              "• `/duel-streak` or `.streak <host>` - View duel win streaks\n" +
              "• `/pot` or `.pot <host>` - View all bets on a duel",
          },
          {
            name: "Dicing/diceduel",
            value:
              "• `/dice-duel` or `.diceduel <opponent> <amount> <currency>` - Challenge someone to a dice duel\n" +
              "• `/diceduel-cancel` or `.ddc` - Cancel your active dice duel\n" +
              "• `/roll` or `.roll` - roll the dice for diceduel\n" +
              "• `/dice` or `.dice <host> <amount> <currency> <bet_on>` - Place a dice bet\n" +
              "• `/dicing-streak` or `.dices [user]` - View dicing streaks\n" +
              "• `/dicepot` or `.dp <host>` - View all bets on a host's dice table",
          },
          {
            name: "Flowergames",
            value:
              "• `/flowerbet` or `.fb <host> <amount> <currency> <bet_type>` - Place a flowerGame bet",
          },
          {
            name: "hot/cold",
            value:
              "• `/hotcoldbet` or `.hcbet <user> <bet_type> <amount>` - place a hot/cold bet\n" +
              "• `/hotcoldpot` or `.hcpot <user>` - View all bets on a host's hot/cold pot",
          },
          {
            name: "misc",
            value:
              "• `/request-host` or `.hosting` - Request a host\n" +
              "• `/request-refund` or `.ref <host>` - Request a refund\n" +
              "• `/mybets` or `.mybets` - View your active bets",
          }
        );
      const hostEmbed = new EmbedBuilder()
        .setColor(0x2196f3)
        .setTitle(`${EMOJIS.host} Host Commands`)
        .addFields(
          {
            name: "Duel Hosting",
            value:
              "• `/duel` or `.duel <type> [user]` - Start a new duel (Whip or Poly)\n" +
              "• `/win` or `.win` - Declare a win and process payouts\n" +
              "• `/loss` or `.loss` - Declare a loss\n" +
              "• `/pot` or `.pot` - View all bets on your duel\n" +
              "• `/cancelduel` or `.cancelduel` - Cancel your duel and refund all bets",
          },
          {
            name: "Dice Hosting",
            value:
              "• `/dicetable <subcommand>` - Manage your dice table\n" +
              "• `.dopen` - Open a dice table\n" +
              "• `.dclose` - Close a dice table\n" +
              "• `.dt` - Toggle betting open/closed\n" +
              "• `/rollresult` or `.rr <roll>` - Enter your dice roll result",
          },
          {
            name: "Flower Hosting",
            value:
              "• `/flowergame` or `.fg <subcommand> [type]` - Start a flower game\n" +
              "• `/set-flowers` or `.sf` - Set the flowergames results",
          },
          {
            name: "hot/cold hosting",
            value:
              "• `/hotcold` or `.hc` - start a hot/cold game\n" +
              "• `/hotcoldhistory` or `.hch` - View the streak history for hot/cold games\n" +
              "• `/hotcoldresult` or `.hcr <result>` - Set the result of a hot/cold game",
          },
          {
            name: "misc",
            value:
              "• `/host-leaderboard` or `.hl <currency> <category>` - View host leaderboard\n" +
              "• `/hoststatus` or `.hs <subcommand>` - Set your hosting status open/closed\n" +
              "• `/universal-refund` or `.refund <player>` - Refund a player's bets across all game modes\n" +
              "• `/placebet` or `.pb <player> <host> <currency> <amount> <duel_type>` - Place a bet on behalf of a player\n" +
              "• `/set-twitch` or `.twitch <username>` - Set your Twitch username for host embeds",
          }
        );

      const adminEmbed = new EmbedBuilder()
        .setColor(0x9c27b0)
        .setTitle(`${EMOJIS.don} Admin Commands`)
        .addFields(
          {
            name: "Wallet Management",
            value:
              "• `/setwallet` or `.set <user> <currency> <amount>` - Set a user's wallet balance\n" +
              "• `/server-wallet` or `.sw [subcommand]` - Manage the server wallet",
          },
          {
            name: "Server Management",
            value:
              "• `/trigger` or `.trigger <subcommand> [name] [response]` - Manage custom text triggers\n" +
              "• `/adminfixstats` or `.fix` - Fix stats for a hosts streak if they are incorrect",
          }
        );

      // Determine which embed to show based on args
      let embedToShow = generalEmbed;
      if (args.length > 0) {
        const category = args[0].toLowerCase();
        switch (category) {
          case "leaderboard":
          case "leaderboards":
          case "lb":
            embedToShow = leaderboardEmbed;
            break;
          case "games":
          case "bet":
            embedToShow = bettingEmbed;
            break;
          case "host":
            if (isHost || isAdmin) {
              embedToShow = hostEmbed;
            }
            break;
          case "admin":
            if (isAdmin) {
              embedToShow = adminEmbed;
            }
            break;
        }
      }

      // Send the embed
      const sentMessage = await message.reply({ embeds: [embedToShow] });

      // Add instructions for viewing other command categories
      await message.channel.send({
        content:
          `${message.author}, use these commands to see other categories:\n` +
          `• \`!commands general\` - General commands\n` +
          `• \`!commands lb\` - Leaderboard commands\n` +
          `• \`!commands games\` - game commands` +
          (isHost || isAdmin ? `\n• \`!commands host\` - Host commands` : "") +
          (isAdmin ? `\n• \`!commands admin\` - Admin commands` : ""),
      });
    } catch (error) {
      console.error("Error in !commands command:", error);
      await message.reply(
        "❌ An error occurred while fetching the commands list."
      );
    }
  },
};
// This command provides a list of available commands in the bot.
// It organizes commands into categories such as General, Leaderboards, Betting, Host, and Admin commands.
