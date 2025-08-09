// utils/PrefixCommandHandler.js
const { Collection } = require('discord.js');
const { logger } = require('./enhanced-logger');
const { handleMessageError } = require('./error-handler');
require('dotenv').config();

// Collection to store prefix commands
const prefixCommands = new Collection();

// Collection to store command cooldowns
const cooldowns = new Collection();

// Default prefix
const DEFAULT_PREFIX = process.env.PREFIX || '!';

// Default cooldown in seconds
const DEFAULT_COOLDOWN = 3;

/**
 * Register a prefix command
 * @param {string} name - The command name
 * @param {Object} command - The command object with a run method
 */
function registerPrefixCommand(name, command) {
    if (!command || typeof command.run !== 'function') {
        logger.warn('PrefixCommandHandler', `Cannot register prefix command "${name}": Invalid command object or missing run method`);
        return;
    }
    
    prefixCommands.set(name.toLowerCase(), command);
    logger.debug('PrefixCommandHandler', `Registered prefix command: ${name}`);
}

/**
 * Handle a message as a potential prefix command
 * @param {import('discord.js').Message} message - The message to handle
 */
async function handlePrefixCommand(message) {
    try {
        // Get the prefix from environment variables or use default
        const prefix = process.env.PREFIX || DEFAULT_PREFIX;
        
        // Check if the message starts with the prefix
        if (!message.content.startsWith(prefix)) return;
        
        // Parse the command and arguments
        const args = message.content.slice(prefix.length).trim().split(/\s+/);
        const commandName = args.shift().toLowerCase();
        
        // Check if the command exists
        const command = prefixCommands.get(commandName);
        if (!command) return;
        
        // Check for cooldowns
        if (checkCooldown(message, command, commandName)) return;
        
        // Execute the command
        try {
            logger.debug('PrefixCommandHandler', `Executing command: ${commandName}`, {
                userId: message.author.id,
                guildId: message.guild?.id,
                args
            });
            
            await command.run(message, args);
        } catch (error) {
            logger.error('PrefixCommandHandler', `Error executing prefix command ${commandName}`, {
                error,
                command: commandName,
                args,
                userId: message.author.id,
                guildId: message.guild?.id
            });
            
            await handleMessageError(error, message, `Command:${commandName}`);
        }
    } catch (error) {
        logger.error('PrefixCommandHandler', 'Error in handlePrefixCommand', {
            error,
            content: message.content,
            userId: message.author.id,
            guildId: message.guild?.id
        });
    }
}

/**
 * Check if a command is on cooldown for a user
 * @param {import('discord.js').Message} message - The message that triggered the command
 * @param {Object} command - The command object
 * @param {string} commandName - The name of the command
 * @returns {boolean} True if the command is on cooldown, false otherwise
 */
function checkCooldown(message, command, commandName) {
    // Get cooldown amount
    const cooldownAmount = (command.cooldown || DEFAULT_COOLDOWN) * 1000;
    
    // Skip cooldown for bot owners or administrators
    if (message.member?.permissions?.has('Administrator')) return false;
    
    // Check if command is on cooldown
    if (!cooldowns.has(commandName)) {
        cooldowns.set(commandName, new Collection());
    }
    
    const now = Date.now();
    const timestamps = cooldowns.get(commandName);
    const userId = message.author.id;
    
    if (timestamps.has(userId)) {
        const expirationTime = timestamps.get(userId) + cooldownAmount;
        
        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            message.reply(`Please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${commandName}\` command.`);
            return true;
        }
    }
    
    // Set cooldown
    timestamps.set(userId, now);
    setTimeout(() => timestamps.delete(userId), cooldownAmount);
    
    return false;
}

/**
 * Get all registered prefix commands
 * @returns {Collection} The collection of prefix commands
 */
function getAllPrefixCommands() {
    return prefixCommands;
}

/**
 * Clear command cooldowns for testing purposes
 * @param {string} [commandName] - Optional command name to clear cooldowns for
 * @param {string} [userId] - Optional user ID to clear cooldowns for
 */
function clearCooldowns(commandName, userId) {
    if (commandName && userId) {
        // Clear specific user's cooldown for specific command
        if (cooldowns.has(commandName)) {
            cooldowns.get(commandName).delete(userId);
        }
    } else if (commandName) {
        // Clear all cooldowns for specific command
        cooldowns.delete(commandName);
    } else {
        // Clear all cooldowns
        cooldowns.clear();
    }
}

module.exports = {
    registerPrefixCommand,
    handlePrefixCommand,
    getAllPrefixCommands,
    clearCooldowns
};