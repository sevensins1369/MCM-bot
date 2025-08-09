// events/messageCreate.js
const { Events } = require('discord.js');
const { handlePrefixCommand } = require("../utils/PrefixCommandHandler");
const { logger } = require('../utils/enhanced-logger');
const { handleMessageError } = require('../utils/error-handler');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      // Ignore messages from bots
      if (message.author.bot) return;
      
      // Handle prefix commands
      await handlePrefixCommand(message);
      
      // Handle triggers if they exist
      await handleTriggers(message);
    } catch (error) {
      logger.error('MessageCreate', 'Unhandled error in message handler', error);
      await handleMessageError(error, message, 'MessageCreate');
    }
  },
};

/**
 * Handle message triggers
 * @param {import('discord.js').Message} message - The message to check for triggers
 */
async function handleTriggers(message) {
  try {
    // Skip if no triggers collection
    if (!message.client.triggers || message.client.triggers.size === 0) return;
    
    // Get the message content
    const content = message.content.toLowerCase();
    
    // Check each trigger
    for (const [triggerName, trigger] of message.client.triggers.entries()) {
      if (content.includes(triggerName.toLowerCase())) {
        // Trigger found, send response
        await message.channel.send(trigger.response);
        logger.debug('Triggers', `Triggered "${triggerName}" in ${message.guild?.name || 'DM'}`);
        break; // Only trigger one response per message
      }
    }
  } catch (error) {
    logger.error('Triggers', 'Error handling message trigger', error);
    // Don't reply to the user for trigger errors to avoid spam
  }
}