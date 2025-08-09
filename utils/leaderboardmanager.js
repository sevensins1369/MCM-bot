// utils/LeaderboardManager.js
const fs = require('fs').promises;
const path = require('path');

// Path to the data file
const dataFilePath = path.join(__dirname, '../data/leaderboards.json');

// Default data structure
const defaultData = {
    hostLeaderboard: {
        osrs: [],
        rs3: []
    },
    donatorLeaderboard: {
        osrs: [],
        rs3: []
    },
    lastUpdated: new Date().toISOString()
};

// Ensure the data file exists
async function ensureDataFile() {
    try {
        await fs.access(dataFilePath);
    } catch (error) {
        // Create directory if it doesn't exist
        try {
            await fs.mkdir(path.dirname(dataFilePath), { recursive: true });
        } catch (mkdirError) {
            if (mkdirError.code !== 'EEXIST') {
                throw mkdirError;
            }
        }
        
        // Create the file with default data
        await fs.writeFile(dataFilePath, JSON.stringify(defaultData, null, 2));
    }
}

// Load leaderboard data
async function loadLeaderboardData() {
    await ensureDataFile();
    
    try {
        const data = await fs.readFile(dataFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading leaderboard data:', error);
        return defaultData;
    }
}

// Save leaderboard data
async function saveLeaderboardData(data) {
    try {
        data.lastUpdated = new Date().toISOString();
        await fs.writeFile(dataFilePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving leaderboard data:', error);
    }
}

// Update host leaderboard
async function updateHostLeaderboard(currency, entries) {
    const data = await loadLeaderboardData();
    data.hostLeaderboard[currency] = entries;
    await saveLeaderboardData(data);
}

// Update donator leaderboard
async function updateDonatorLeaderboard(currency, entries) {
    const data = await loadLeaderboardData();
    data.donatorLeaderboard[currency] = entries;
    await saveLeaderboardData(data);
}

// Get host leaderboard
async function getHostLeaderboard(currency) {
    const data = await loadLeaderboardData();
    return data.hostLeaderboard[currency] || [];
}

// Get donator leaderboard
async function getDonatorLeaderboard(currency) {
    const data = await loadLeaderboardData();
    return data.donatorLeaderboard[currency] || [];
}

module.exports = {
    updateHostLeaderboard,
    updateDonatorLeaderboard,
    getHostLeaderboard,
    getDonatorLeaderboard
};

// This module manages the leaderboard data for hosts and donators.
// It provides functions to load, save, and update the leaderboard data in a JSON file.