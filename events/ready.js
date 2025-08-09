// events/ready.js
const { Events, ActivityType } = require("discord.js");
const { logger } = require('../utils/enhanced-logger');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    try {
      logger.info('Bot', `Ready! Logged in as ${client.user.tag} (ID: ${client.user.id})`);
      logger.info('Bot', `Connected to ${client.guilds.cache.size} servers`);

      // Set up status rotation
      setupStatusRotation(client);

      // Log some additional information
      logBotInfo(client);
    } catch (error) {
      logger.error('Ready', 'Error during client initialization', error);
    }
  },
};

/**
 * Set up rotating status messages
 * @param {import('discord.js').Client} client - The Discord client
 */
function setupStatusRotation(client) {
  // Define status messages
  const statusMessages = [
    { type: ActivityType.Playing, message: '!help | /help' },
    { type: ActivityType.Playing, message: 'dice games' },
    { type: ActivityType.Watching, message: 'for bets' },
    { type: ActivityType.Listening, message: 'to commands' },
    { type: ActivityType.Competing, message: 'in duels' }
  ];

  // Set initial status
  updateStatus(client, statusMessages[0]);

  // Rotate status every 15 minutes
  let currentIndex = 0;
  setInterval(() => {
    currentIndex = (currentIndex + 1) % statusMessages.length;
    updateStatus(client, statusMessages[currentIndex]);
  }, 15 * 60 * 1000); // 15 minutes
}

/**
 * Update the bot's status
 * @param {import('discord.js').Client} client - The Discord client
 * @param {Object} status - The status object with type and message
 */
function updateStatus(client, status) {
  try {
    client.user.setActivity(status.message, { type: status.type });
    logger.debug('Status', `Updated status to: ${status.type} ${status.message}`);
  } catch (error) {
    logger.error('Status', 'Failed to update status', error);
  }
}

/**
 * Log additional bot information
 * @param {import('discord.js').Client} client - The Discord client
 */
function logBotInfo(client) {
  // Log command count
  const commandCount = client.commands?.size || 0;
  logger.info('Bot', `Loaded ${commandCount} slash commands`);

  // Log trigger count
  const triggerCount = client.triggers?.size || 0;
  logger.info('Bot', `Loaded ${triggerCount} message triggers`);

  // Log memory usage
  const memoryUsage = process.memoryUsage();
  logger.debug('Bot', 'Memory usage', {
    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
  });
}