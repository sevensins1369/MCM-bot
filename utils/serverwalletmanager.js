// utils/ServerWalletManager.js
const ServerWallet = require('../models/serverwallet');

async function getServerWallet(guildId) {
    if (!guildId) throw new Error("Guild ID is required.");

    let walletDoc = await ServerWallet.findOne({ guildId });

    if (!walletDoc) {
        walletDoc = await ServerWallet.create({ guildId, osrs: '0', rs3: '0' });
    }

    // --- BIGINT UPDATE: Convert strings from DB to BigInt for app use ---
    return {
        ...walletDoc.toObject(),
        osrs: BigInt(walletDoc.osrs),
        rs3: BigInt(walletDoc.rs3),
    };
}

async function updateServerWallet(guildId, newWallet) {
    if (!guildId) throw new Error("Guild ID is required.");
    if (typeof newWallet !== 'object' || newWallet === null) {
        throw new Error("Invalid wallet data provided.");
    }

    // --- BIGINT UPDATE: Convert BigInts to strings for DB storage ---
    const updateData = {
        osrs: newWallet.osrs.toString(),
        rs3: newWallet.rs3.toString(),
        updatedAt: Date.now(),
    };

    await ServerWallet.findOneAndUpdate(
        { guildId },
        { $set: updateData },
        { upsert: true }
    );
}

module.exports = {
    getServerWallet,
    updateServerWallet,
};

// utils/ServerWalletManager.js
// This module manages server wallets for guilds, allowing retrieval and updates.