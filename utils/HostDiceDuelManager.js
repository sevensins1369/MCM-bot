// utils/HostDiceDuelManager.js
const activeDuels = new Map(); // Key: messageId, Value: duelData

/**
 * Creates a new pending dice duel.
 * @param {string} messageId The ID of the message displaying the duel.
 * @param {object} duelData The data for the duel.
 */
function createDuel(messageId, duelData) {
    activeDuels.set(messageId, duelData);
    // Automatically cancel the duel after 5 minutes if the host doesn't roll
    setTimeout(() => {
        const duel = activeDuels.get(messageId);
        if (duel && duel.status === 'pending_host_roll') {
            cancelDuel(messageId, "The host did not roll in time. Duel cancelled and bet refunded.");
        }
    }, 5 * 60 * 1000); // 5 minutes
}

/**
 * Retrieves an active dice duel.
 * @param {string} messageId The ID of the message.
 * @returns {object|undefined} The duel data.
 */
function getDuel(messageId) {
    return activeDuels.get(messageId);
}

/**
 * Updates the state of an active dice duel.
 * @param {string} messageId The ID of the message.
 * @param {object} newData The new data to merge into the duel state.
 */
function updateDuel(messageId, newData) {
    if (activeDuels.has(messageId)) {
        const duel = activeDuels.get(messageId);
        activeDuels.set(messageId, { ...duel, ...newData });
    }
}

/**
 * Removes a duel from the active list.
 * @param {string} messageId The ID of the message.
 */
function removeDuel(messageId) {
    activeDuels.delete(messageId);
}

/**
 * Cancels a duel and refunds the player.
 * @param {string} messageId The ID of the message.
 * @param {string} reason The reason for cancellation.
 */
async function cancelDuel(messageId, reason) {
    const duel = getDuel(messageId);
    if (!duel) return;

    const { WalletManager, interaction, player, amount, currency } = duel;
    try {
        const playerWallet = await WalletManager.getWallet(player.id);
        playerWallet[currency] += amount;
        await WalletManager.updateWallet(player.id, playerWallet);
        
        await interaction.editReply({
            content: reason,
            embeds: [],
            components: [],
        });
    } catch (error) {
        console.error("Critical error during duel cancellation refund:", error);
    } finally {
        removeDuel(messageId);
    }
}

module.exports = {
    createDuel,
    getDuel,
    updateDuel,
    removeDuel,
    cancelDuel,
};

// utils/WalletManager.js