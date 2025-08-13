// utils/serverwalletmanager.js
const ServerWallet = require("../models/ServerWallet");
const { logger } = require("../enhanced-logger");
const { ValidationError } = require("../utils/error-handler");

/**
 * Get a server wallet by guild ID
 * @param {string} guildId - The Discord guild ID
 * @returns {Promise<Object>} The wallet object with BigInt values
 */
async function getServerWallet(guildId) {
  if (!guildId) {
    throw new ValidationError("Guild ID is required.");
  }

  try {
    // Try to find by serverId first (new field)
    let walletDoc = await ServerWallet.findOne({ serverId: guildId });

    // If not found, try by guildId (legacy field)
    if (!walletDoc) {
      walletDoc = await ServerWallet.findOne({ guildId });
    }

    // If still not found, create a new wallet
    if (!walletDoc) {
      walletDoc = await ServerWallet.create({
        serverId: guildId,
        guildId: guildId, // Set both for compatibility
        osrs: "0",
        rs3: "0",
      });
      logger.info(
        "ServerWalletManager",
        `Created new server wallet for guild ${guildId}`
      );
    }

    // --- BIGINT UPDATE: Convert strings from DB to BigInt for app use ---
    return {
      ...walletDoc.toObject(),
      osrs: BigInt(walletDoc.osrs || "0"),
      rs3: BigInt(walletDoc.rs3 || "0"),
    };
  } catch (error) {
    logger.error(
      "ServerWalletManager",
      `Error getting server wallet: ${error.message}`,
      error
    );
    throw new Error(`Failed to get server wallet: ${error.message}`);
  }
}

/**
 * Update a server wallet
 * @param {string} guildId - The Discord guild ID
 * @param {Object} newWallet - The wallet data to update
 * @returns {Promise<void>}
 */
async function updateServerWallet(guildId, newWallet) {
  if (!guildId) {
    throw new ValidationError("Guild ID is required.");
  }

  if (typeof newWallet !== "object" || newWallet === null) {
    throw new ValidationError("Invalid wallet data provided.");
  }

  try {
    // --- BIGINT UPDATE: Convert BigInts to strings for DB storage ---
    const updateData = {
      serverId: guildId, // Ensure serverId is set
      guildId: guildId, // Keep guildId for backward compatibility
      osrs: newWallet.osrs.toString(),
      rs3: newWallet.rs3.toString(),
      updatedAt: Date.now(),
    };

    await ServerWallet.findOneAndUpdate(
      { serverId: guildId },
      { $set: updateData },
      { upsert: true, new: true }
    );

    logger.info(
      "ServerWalletManager",
      `Updated server wallet for guild ${guildId}`
    );
  } catch (error) {
    logger.error(
      "ServerWalletManager",
      `Error updating server wallet: ${error.message}`,
      error
    );
    throw new Error(`Failed to update server wallet: ${error.message}`);
  }
}

module.exports = {
  getServerWallet,
  updateServerWallet,
};

// This module manages server wallets for guilds, allowing retrieval and updates.
