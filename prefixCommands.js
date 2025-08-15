// prefixCommands.js
const { registerPrefixCommand } = require("./utils/PrefixCommandHandler");
const { getDefaultCurrency } = require("./utils/UserPreferencesManager");
const { logger } = require("./enhanced-logger");

/**
 * A helper function to find a user in the message's context.
 * It can find a user by their mention, ID, username, or full tag.
 * @param {string[]} args - The arguments array, where the first element is the user identifier.
 * @param {import('discord.js').Message} message - The message object to get context from.
 * @returns {import('discord.js').User|null} The found user object or null.
 */
function findUser(args, message) {
  if (!args.length) return null;

  const identifier = args[0];

  // Check if it's a mention
  const mentionMatch = identifier.match(/^<@!?(\d+)>$/);
  if (mentionMatch) {
    return message.client.users.cache.get(mentionMatch[1]) || null;
  }

  // Check if it's a user ID
  if (/^\d+$/.test(identifier)) {
    return message.client.users.cache.get(identifier) || null;
  }

  // Check if it's a username or tag
  return (
    message.client.users.cache.find(
      (user) =>
        user.username.toLowerCase() === identifier.toLowerCase() ||
        user.tag.toLowerCase() === identifier.toLowerCase()
    ) || null
  );
}

/**
 * Register all prefix commands
 */
function registerAllPrefixCommands() {
  //commands command
  registerPrefixCommand("commands", require("./commands/commands"));

  // Wallet commands
  registerPrefixCommand("wallet", require("./commands/wallet"));
  registerPrefixCommand("w", require("./commands/wallet"));
  registerPrefixCommand("bal", require("./commands/wallet"));
  registerPrefixCommand("balance", require("./commands/wallet"));

  registerPrefixCommand("viewwallet", require("./commands/viewwallet"));
  registerPrefixCommand("view", require("./commands/viewwallet"));
  registerPrefixCommand("vw", require("./commands/viewwallet"));

  registerPrefixCommand("send", require("./commands/send"));
  registerPrefixCommand("pay", require("./commands/send"));
  registerPrefixCommand("give", require("./commands/send"));

  registerPrefixCommand("wallet-privacy", require("./commands/wallet-privacy"));
  registerPrefixCommand("priv", require("./commands/wallet-privacy"));

  registerPrefixCommand("lock-wallet", require("./commands/lock-wallet"));
  registerPrefixCommand("lock", require("./commands/lock-wallet"));

  registerPrefixCommand("default", require("./commands/set-default"));

  // Dice game commands
  registerPrefixCommand("dice", require("./commands/dice"));
  registerPrefixCommand("d", require("./commands/dice"));

  // Dice duel commands
  registerPrefixCommand("dd", require("./commands/dice-duel"));
  registerPrefixCommand("diceduel", require("./commands/dice-duel"));

  registerPrefixCommand("roll", require("./commands/diceduel-roll"));

  registerPrefixCommand("ddc", require("./commands/diceduel-cancel"));

  //hotcold commands
  registerPrefixCommand("hotcold", require("./commands/hotcold"));
  registerPrefixCommand("hc", require("./commands/hotcold"));

  registerPrefixCommand("hcbet", require("./commands/hotcoldbet"));

  // Flower game commands
  registerPrefixCommand("flowerbet", require("./commands/flowerbet"));
  registerPrefixCommand("fb", require("./commands/flowerbet"));

  // Jackpot commands
  registerPrefixCommand("createjackpot", require("./commands/create-jackpot"));
  registerPrefixCommand("cjp", require("./commands/create-jackpot"));

  registerPrefixCommand("enterjackpot", require("./commands/enter-jackpot"));
  registerPrefixCommand("ejp", require("./commands/enter-jackpot"));

  registerPrefixCommand("jp", require("./commands/jackpot-info"));
  registerPrefixCommand("jackpot", require("./commands/jackpot-info"));

  registerPrefixCommand("canceljackpot", require("./commands/cancel-jackpot"));
  registerPrefixCommand("canjp", require("./commands/cancel-jackpot"));

  // Betting commands
  registerPrefixCommand("bet", require("./commands/bet"));
  registerPrefixCommand("b", require("./commands/bet"));

  registerPrefixCommand("mybets", require("./commands/mybets"));
  registerPrefixCommand("mb", require("./commands/mybets"));

  // Pot commands
  registerPrefixCommand("pot", require("./commands/pot"));
  registerPrefixCommand("p", require("./commands/pot"));

  registerPrefixCommand("dicepot", require("./commands/dicepot"));
  registerPrefixCommand("dp", require("./commands/dicepot"));

  registerPrefixCommand("flowerpot", require("./commands/flowerpot"));
  registerPrefixCommand("fp", require("./commands/flowerpot"));

  // Streak commands
  registerPrefixCommand("dices", require("./commands/dicing-streak"));

  registerPrefixCommand("duelstreak", require("./commands/duelstreak"));
  registerPrefixCommand("ds", require("./commands/duelstreak"));

  // Leaderboard commands
  registerPrefixCommand("lb07", require("./commands/leaderboard-07"));

  registerPrefixCommand("lbrs3", require("./commands/leaderboard-rs3"));

  registerPrefixCommand("hlb", require("./commands/host-leaderboard"));

  registerPrefixCommand("dlb", require("./commands/donator-leaderboard"));

  registerPrefixCommand("flb", require("./commands/flower-leaderboard"));
  registerPrefixCommand("flowerlb", require("./commands/flower-leaderboard"));

  registerPrefixCommand("ddlb", require("./commands/diceduel-leaderboard"));

  // Stats commands
  registerPrefixCommand("mystats", require("./commands/mystats"));
  registerPrefixCommand("ms", require("./commands/mystats"));

  // Host commands
  registerPrefixCommand("hoststatus", require("./commands/hoststatus"));
  registerPrefixCommand("hs", require("./commands/hoststatus"));

  registerPrefixCommand("win", require("./commands/win"));
  registerPrefixCommand("loss", require("./commands/loss"));

  registerPrefixCommand("twitch", require("./commands/set-twitch"));

  registerPrefixCommand("rr", require("./commands/rollresult"));

  registerPrefixCommand("hotcold", require("./commands/hotcold"));
  registerPrefixCommand("hc", require("./commands/hotcold"));

  registerPrefixCommand("hch", require("./commands/hotcoldhistory"));

  registerPrefixCommand("hcr", require("./commands/hotcoldresult"));

  registerPrefixCommand("hcpot", require("./commands/hotcoldpot"));

  registerPrefixCommand("flowergame", require("./commands/flowergame"));
  registerPrefixCommand("fg", require("./commands/flowergame"));

  registerPrefixCommand("refund", require("./commands/universal-refund"));

  registerPrefixCommand("placebet", require("./commands/placebet"));
  registerPrefixCommand("pb", require("./commands/placebet"));

  // Misc commands
  registerPrefixCommand("donate", require("./commands/donate"));
  registerPrefixCommand("vip", require("./commands/vip"));

  registerPrefixCommand("swap", require("./commands/swap"));

  registerPrefixCommand("cashin", require("./commands/cashin"));
  registerPrefixCommand("cashout", require("./commands/cashout"));

  registerPrefixCommand("ref", require("./commands/request-refund"));

  registerPrefixCommand("request-host", require("./commands/request-host"));
  registerPrefixCommand("rh", require("./commands/request-host"));

  // Settings commands
  registerPrefixCommand("default", require("./commands/set-default"));

  registerPrefixCommand("check", require("./commands/check-default"));

  registerPrefixCommand("setflowers", require("./commands/setflowers"));
  registerPrefixCommand("sf", require("./commands/setflowers"));

  // Admin commands
  registerPrefixCommand("env", require("./commands/check-env"));

  registerPrefixCommand("fix", require("./commands/adminfixstats"));

  registerPrefixCommand("setwallet", require("./commands/setwallet"));
  registerPrefixCommand("set", require("./commands/setwallet"));

  registerPrefixCommand("server-wallet", require("./commands/server-wallet"));
  registerPrefixCommand("sw", require("./commands/server-wallet"));
  // Dice table
  registerPrefixCommand("dicetable", require("./commands/dicetable"));
  registerPrefixCommand("dt", require("./commands/dicetable"));

  // Duel
  registerPrefixCommand("duel", require("./commands/duel"));

  registerPrefixCommand("cancelduel", require("./commands/cancelduel"));

  logger.info("PrefixCommands", "All prefix commands registered successfully");
}

module.exports = { registerAllPrefixCommands, findUser };
