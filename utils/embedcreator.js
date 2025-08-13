// utils/embedcreator.js
const { EmbedBuilder } = require("discord.js");
const UserProfile = require("../models/UserProfile");

function formatAmount(amount) {
  const n = BigInt(amount);
  if (n >= 1_000_000_000_000_000_000n)
    return `${(Number(n / 1_000_000_000_000_000n) / 1000).toFixed(1)}q`;
  if (n >= 1_000_000_000_000n)
    return `${(Number(n / 1_000_000_000n) / 1000).toFixed(1)}t`;
  if (n >= 1_000_000_000n)
    return `${(Number(n / 1_000_000n) / 1000).toFixed(1)}b`;
  if (n >= 1_000_000n) return `${(Number(n / 1000n) / 1000).toFixed(1)}m`;
  if (n >= 1000n) return `${(Number(n) / 1000).toFixed(1)}k`;
  return n.toString();
}

const EMOJIS = {
  stash: "<:the_stash:1393917010102059080>",
  wanted: "<:most_wanted:1393677681635233873>",
  dice: "<a:diceroll:1393913150830542858>",
  don: "<:don:1393750283556753569>",
  skull: "<a:host:1393669798398922862>",
  diamond: "<a:black_diamond:1393679444777898088>",
  closed: "<a:closed:1393918723663990968>",
  guns: "<:Dual_guns:13936798310649osrs849>",
  host: "<:host:1393911361393786900>",
  bet: "<a:stacks:1393915171952394290>",
  win: "<:win:1393780116433272962>",
  loss: "<:loss:1393780418893054013>",
  cards: "<:the_stash:1393917010102059080>",
  JACKPOT: "🎰", // Added jackpot emoji
  WARNING: "⚠️", // Added warning emoji
  BLACK: "<:blkflower:>",
  WHITE: "<:whtflower:>",
  BLUE: "<:bluflower:>",
  PURPLE: "<:pflower:>",
  PASTEL: "<:pastlflower:>",
  RAINBOW: "<:rainflower:>",
  RED: "<:redflower:>",
  ORANGE: "<:oflower:>",
  YELLOW: "<:yllwflower:>",
  REDFIRE: "<a:redfire:1405145779257212939>",
  YLWFIRE: "<a:ylwfire:1405145700789915809>",
  BLKFIRE: "<a:blkfire:1405145751268495491>",
  ORGFIRE: "<a:orngfire:1405145726484480040>",
  BLUSNOW: "<a:shimmer2:1405144293835804782>",
  PRPSNOW: "<a:shimmer3:1405144410559348786>",
  GRNSNOW: "<a:shimmer:1405144223316971590>",
  WHTSNOW: "<a:shimmer1:1405144251490238476>",
};

async function createDuelEmbed(duel, host, client) {
  const userProfile = await UserProfile.findOne({ userId: host.id });
  const twitchUsername = userProfile?.twitchUsername;

  const embed = new EmbedBuilder()
    .setColor(0x800000)
    .setTitle(`${EMOJIS.bet} The Job.`)
    .setDescription(
      `*${host.username}'s ${duel.duelType} duel is open for bets.*`
    )
    .setThumbnail(host.displayAvatarURL())
    .setFooter({
      text: `"The offer you can't refuse."`,
      iconURL: client.user.displayAvatarURL(),
    });

  if (twitchUsername) {
    embed.setURL(`https://www.twitch.tv/${twitchUsername}`);
    embed.setTitle(`${EMOJIS.bet} The Job (Live on Twitch!)`);
  }

  if (duel.bets && duel.bets.length > 0) {
    const osrsBets = duel.bets.filter((b) => b.currency === "osrs");
    const rs3Bets = duel.bets.filter((b) => b.currency === "rs3");
    const totalOsrs = osrsBets.reduce((sum, b) => sum + BigInt(b.amount), 0n);
    const totalRs3 = rs3Bets.reduce((sum, b) => sum + BigInt(b.amount), 0n);
    embed.addFields({
      name: `${EMOJIS.don} Host: ${host.username} • ${EMOJIS.guns} ${duel.duelType}`,
      value: `${duel.bets.length} bets • ${formatAmount(
        totalOsrs
      )} osrs • ${formatAmount(totalRs3)} RS3`,
      inline: false,
    });
  } else {
    embed.addFields({
      name: `${EMOJIS.don} Host: ${host.username} • ${EMOJIS.guns} ${duel.duelType} duel.`,
      value: "*No bets yet. Be the first.*",
      inline: false,
    });
  }
  return embed;
}

async function createPotEmbed(duel, host, client) {
  const userProfile = await UserProfile.findOne({ userId: host.id });
  const twitchUsername = userProfile?.twitchUsername;
  const osrsBets = duel.bets
    ? duel.bets.filter((b) => b.currency === "osrs")
    : [];
  const rs3Bets = duel.bets
    ? duel.bets.filter((b) => b.currency === "rs3")
    : [];
  const totalOsrs = osrsBets.reduce((sum, b) => sum + BigInt(b.amount), 0n);
  const totalRs3 = rs3Bets.reduce((sum, b) => sum + BigInt(b.amount), 0n);

  const embed = new EmbedBuilder()
    .setColor(0xdaa520)
    .setTitle(`${EMOJIS.stash} The Crew's Cut.`)
    .setDescription(
      `*${host.username}'s ${duel.duelType} duel is open for bets.*`
    )
    .addFields(
      {
        name: `osrs Total Pot`,
        value: formatAmount(totalOsrs * 2n),
        inline: true,
      },
      {
        name: `RS3 Total Pot`,
        value: formatAmount(totalRs3 * 2n),
        inline: true,
      }
    )
    .setThumbnail(host.displayAvatarURL())
    .setFooter({
      text: `"Keep your friends close, but your money closer"`,
      iconURL: client.user.displayAvatarURL(),
    });

  if (twitchUsername) {
    embed.setURL(`https://www.twitch.tv/${twitchUsername}`);
  }

  if (duel.bets && duel.bets.length > 0) {
    const bettorsList = duel.bets
      .map((bet) => {
        const amount = BigInt(bet.amount);
        return `<@${bet.playerId}> - **${formatAmount(
          amount
        )} ${bet.currency.toUpperCase()}**`;
      })
      .join("\n")
      .slice(0, 1024);
    embed.addFields({
      name: `${EMOJIS.bet} Bettors (${duel.bets.length})`,
      value: bettorsList || "No bets yet.",
    });
  }
  return embed;
}

async function createWinEmbed(duel, user, totalPayout, payoutDetails, client) {
  const userProfile = await UserProfile.findOne({ userId: user.id });
  const twitchUsername = userProfile?.twitchUsername;
  const embed = new EmbedBuilder()
    .setColor(0x00c853)
    .setTitle(`${EMOJIS.win} We finished the job gang!`)
    .setDescription(`*${user.username} won the ${duel.duelType} duel.*`)
    .setThumbnail(user.displayAvatarURL())
    .setFooter({
      text: `"Easy come, easy go" • ${duel.bets.length} bets settled`,
      iconURL: client.user.displayAvatarURL(),
    });

  if (twitchUsername) {
    embed.setURL(`https://www.twitch.tv/${twitchUsername}`);
  }

  if (payoutDetails["osrs"].length > 0) {
    const osrsWinners = payoutDetails["osrs"]
      .map((w) => `<@${w.playerId}> +**${formatAmount(w.profit)}**`)
      .join("\n")
      .slice(0, 1024);
    embed.addFields({
      name: `${EMOJIS.win} osrs Winners`,
      value: osrsWinners || "None",
      inline: true,
    });
  }

  if (payoutDetails.rs3.length > 0) {
    const rs3Winners = payoutDetails.rs3
      .map((w) => `<@${w.playerId}> +**${formatAmount(w.profit)}**`)
      .join("\n")
      .slice(0, 1024);
    embed.addFields({
      name: `${EMOJIS.win} RS3 Winners`,
      value: rs3Winners || "None",
      inline: true,
    });
  }

  return embed;
}

async function createLossEmbed(duel, user, totalLost, client) {
  const userProfile = await UserProfile.findOne({ userId: user.id });
  const twitchUsername = userProfile?.twitchUsername;
  const embed = new EmbedBuilder()
    .setColor(0xd32f2f)
    .setTitle(`${EMOJIS.loss} The Job Went South.`)
    .setDescription(
      `*${user.username} lost his life in a ${duel.duelType} duel.*`
    )
    .setThumbnail(user.displayAvatarURL())
    .setFooter({
      text: `"You win some, you lose some" • ${duel.bets.length} bets settled`,
      iconURL: client.user.displayAvatarURL(),
    });

  if (twitchUsername) {
    embed.setURL(`https://www.twitch.tv/${twitchUsername}`);
  }

  if (duel.bets && duel.bets.length > 0) {
    const osrsBets = duel.bets.filter((b) => b.currency === "osrs");
    const rs3Bets = duel.bets.filter((b) => b.currency === "rs3");

    if (osrsBets.length > 0) {
      const osrsLosers = osrsBets
        .map(
          (bet) => `<@${bet.playerId}> -**${formatAmount(BigInt(bet.amount))}**`
        )
        .join("\n")
        .slice(0, 1024);
      embed.addFields({
        name: `${EMOJIS.loss} osrs Losses`,
        value: osrsLosers || "None",
        inline: true,
      });
    }

    if (rs3Bets.length > 0) {
      const rs3Losers = rs3Bets
        .map(
          (bet) => `<@${bet.playerId}> -**${formatAmount(BigInt(bet.amount))}**`
        )
        .join("\n")
        .slice(0, 1024);
      embed.addFields({
        name: `${EMOJIS.loss} RS3 Losses`,
        value: rs3Losers || "None",
        inline: true,
      });
    }
  }

  return embed;
}

// New function for creating jackpot embeds
async function createJackpotEmbed(jackpot, client) {
  const embed = new EmbedBuilder()
    .setColor(0xffd700) // Gold color
    .setTitle(
      `${EMOJIS.JACKPOT} JACKPOT #${jackpot.gameId.substring(0, 8)} ${
        EMOJIS.JACKPOT
      }`
    )
    .setDescription(
      `A jackpot game is in progress! Enter for a chance to win the entire pot!`
    )
    .addFields(
      { name: "Currency", value: jackpot.currency.toUpperCase(), inline: true },
      {
        name: "Minimum Entry",
        value: formatAmount(jackpot.minEntryAmount),
        inline: true,
      },
      {
        name: "Drawing In",
        value: `<t:${Math.floor(
          new Date(jackpot.drawTime).getTime() / 1000
        )}:R>`,
        inline: true,
      },
      {
        name: "Total Pot",
        value: `${formatAmount(
          jackpot.totalPot
        )} ${jackpot.currency.toUpperCase()}`,
        inline: true,
      },
      {
        name: "Entries",
        value: jackpot.entries.length.toString(),
        inline: true,
      },
      { name: "Created By", value: `<@${jackpot.createdBy}>`, inline: true }
    )
    .setTimestamp()
    .setFooter({
      text: `Game ID: ${jackpot.gameId}`,
      iconURL: client.user.displayAvatarURL(),
    });

  return embed;
}

module.exports = {
  formatAmount,
  createDuelEmbed,
  createPotEmbed,
  createWinEmbed,
  createLossEmbed,
  createJackpotEmbed,
  EMOJIS,
};
