// utils/error-handler.js
const { logger } = require('./enhanced-logger');

/**
 * Custom error classes for different types of errors
 */
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.statusCode = 400;
  }
}

class AuthorizationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthorizationError';
    this.code = 'AUTHORIZATION_ERROR';
    this.statusCode = 403;
  }
}

class DatabaseError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'DatabaseError';
    this.code = 'DATABASE_ERROR';
    this.statusCode = 500;
    this.originalError = originalError;
  }
}

class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigurationError';
    this.code = 'CONFIGURATION_ERROR';
    this.statusCode = 500;
  }
}

/**
 * Error handler for Discord interactions
 * @param {Error} error - The error that occurred
 * @param {Object} interaction - Discord interaction object
 * @param {string} source - Source of the error
 */
async function handleInteractionError(error, interaction, source) {
  // Log the error
  logger.error(source, `Error handling interaction: ${error.message}`, error);
  
  // Prepare user-friendly message based on error type
  let userMessage = 'An error occurred while processing your request.';
  let isEphemeral = true;
  
  if (error instanceof ValidationError) {
    userMessage = `⚠️ ${error.message}`;
  } else if (error instanceof AuthorizationError) {
    userMessage = `⛔ You don't have permission to use this command.`;
  } else if (error instanceof DatabaseError) {
    userMessage = `🔧 There was a problem accessing your data. Please try again later.`;
  } else {
    // For unexpected errors, provide a more generic message
    userMessage = `❌ Something went wrong. Our team has been notified.`;
  }
  
  // Respond to the interaction if possible
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: userMessage, ephemeral: isEphemeral });
    } else {
      await interaction.reply({ content: userMessage, ephemeral: isEphemeral });
    }
  } catch (replyError) {
    logger.error(source, `Failed to reply to interaction after error: ${replyError.message}`, {
      originalError: error,
      replyError
    });
  }
}

/**
 * Error handler for message commands
 * @param {Error} error - The error that occurred
 * @param {Object} message - Discord message object
 * @param {string} source - Source of the error
 */
async function handleMessageError(error, message, source) {
  // Log the error
  logger.error(source, `Error handling message command: ${error.message}`, error);
  
  // Prepare user-friendly message based on error type
  let userMessage = 'An error occurred while processing your request.';
  
  if (error instanceof ValidationError) {
    userMessage = `⚠️ ${error.message}`;
  } else if (error instanceof AuthorizationError) {
    userMessage = `⛔ You don't have permission to use this command.`;
  } else if (error instanceof DatabaseError) {
    userMessage = `🔧 There was a problem accessing your data. Please try again later.`;
  } else {
    // For unexpected errors, provide a more generic message
    userMessage = `❌ Something went wrong. Our team has been notified.`;
  }
  
  // Respond to the message if possible
  try {
    await message.reply(userMessage);
  } catch (replyError) {
    logger.error(source, `Failed to reply to message after error: ${replyError.message}`, {
      originalError: error,
      replyError
    });
  }
}

/**
 * Wraps an async function with error handling
 * @param {Function} fn - The function to wrap
 * @param {string} source - Source identifier for logging
 * @returns {Function} - Wrapped function with error handling
 */
function withErrorHandling(fn, source) {
  return async function(...args) {
    try {
      return await fn(...args);
    } catch (error) {
      // Determine if this is an interaction or message command
      const firstArg = args[0];
      if (firstArg && firstArg.reply && firstArg.deferReply) {
        // This is likely an interaction
        await handleInteractionError(error, firstArg, source);
      } else if (firstArg && firstArg.reply && firstArg.channel) {
        // This is likely a message
        await handleMessageError(error, firstArg, source);
      } else {
        // Just log the error if we can't determine the context
        logger.error(source, `Unhandled error: ${error.message}`, error);
      }
    }
  };
}

/**
 * Validates user input
 * @param {*} value - The value to validate
 * @param {string} name - Name of the value for error messages
 * @param {Function} validator - Validation function that returns true if valid
 * @param {string} message - Custom error message
 * @throws {ValidationError} If validation fails
 */
function validateInput(value, name, validator, message) {
  if (!validator(value)) {
    throw new ValidationError(message || `Invalid ${name}`);
  }
}

/**
 * Checks if user has required permissions
 * @param {Object} member - Discord guild member
 * @param {Array|string} requiredPermissions - Required permissions
 * @throws {AuthorizationError} If user doesn't have required permissions
 */
function checkPermissions(member, requiredPermissions) {
  if (!member.permissions.has(requiredPermissions)) {
    throw new AuthorizationError('You do not have permission to use this command');
  }
}

/**
 * Safely executes a database operation with error handling
 * @param {Function} dbOperation - Database operation function
 * @param {string} errorMessage - Error message if operation fails
 * @returns {Promise<*>} - Result of the database operation
 * @throws {DatabaseError} If database operation fails
 */
async function safeDbOperation(dbOperation, errorMessage) {
  try {
    return await dbOperation();
  } catch (error) {
    throw new DatabaseError(errorMessage || 'Database operation failed', error);
  }
}

module.exports = {
  ValidationError,
  AuthorizationError,
  DatabaseError,
  ConfigurationError,
  handleInteractionError,
  handleMessageError,
  withErrorHandling,
  validateInput,
  checkPermissions,
  safeDbOperation
};