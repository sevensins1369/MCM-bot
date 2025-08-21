// utils/UserPreferencesManager.js
const mongoose = require("mongoose");
const { isUsingMongoDB } = require("./database");
const fs = require("fs");
const path = require("path");

// In-memory cache
const preferencesCache = new Map();

// File path for local storage
const PREFERENCES_FILE = path.join(__dirname, "/container/data/userPreferences.json");

/**
 * Get user preferences
 * @param {string} userId - The user's Discord ID
 * @returns {Object} The user's preferences
 */
async function getUserPreferences(userId) {
  // Check cache first
  if (preferencesCache.has(userId)) {
    return preferencesCache.get(userId);
  }

  try {
    if (isUsingMongoDB()) {
      // Try to get from MongoDB
      const UserPreferences = require("../models/UserPreferences");
      if (!UserPreferences) {
        return createDefaultPreferences(userId);
      }

      const preferences = await UserPreferences.findOne({ userId });
      if (preferences) {
        const preferencesData = {
          userId: preferences.userId,
          defaultCurrency: preferences.defaultCurrency,
          twitchUsername: preferences.twitchUsername,
          flowerPreference: preferences.flowerPreference,
          updatedAt: preferences.updatedAt,
        };
        preferencesCache.set(userId, preferencesData);
        return preferencesData;
      }
    } else {
      // Try to get from file
      return getPreferencesFromFile(userId);
    }

    // If not found, create default preferences
    return createDefaultPreferences(userId);
  } catch (error) {
    console.error(`Error getting preferences for user ${userId}:`, error);
    return createDefaultPreferences(userId);
  }
}

/**
 * Get preferences from file
 * @param {string} userId - The user's Discord ID
 * @returns {Object} The user's preferences
 */
function getPreferencesFromFile(userId) {
  try {
    if (fs.existsSync(PREFERENCES_FILE)) {
      const data = fs.readFileSync(PREFERENCES_FILE, "utf8");
      const preferences = JSON.parse(data);

      if (preferences[userId]) {
        preferencesCache.set(userId, preferences[userId]);
        return preferences[userId];
      }
    }

    // If not found, create default preferences
    return createDefaultPreferences(userId);
  } catch (error) {
    console.error(
      `Error reading preferences from file for user ${userId}:`,
      error
    );
    return createDefaultPreferences(userId);
  }
}

/**
 * Create default preferences
 * @param {string} userId - The user's Discord ID
 * @returns {Object} The default preferences
 */
function createDefaultPreferences(userId) {
  const defaultPreferences = {
    userId,
    defaultCurrency: "osrs",
    twitchUsername: null,
    flowerPreference: "random",
    updatedAt: new Date(),
  };

  preferencesCache.set(userId, defaultPreferences);
  savePreferences();
  return defaultPreferences;
}

/**
 * Update user preferences
 * @param {string} userId - The user's Discord ID
 * @param {Object} updates - The updates to apply
 * @returns {Object} The updated preferences
 */
async function updateUserPreferences(userId, updates) {
  try {
    // Get current preferences
    const preferences = await getUserPreferences(userId);

    // Apply updates
    Object.assign(preferences, updates, { updatedAt: new Date() });

    // Update cache
    preferencesCache.set(userId, preferences);

    // Save to storage
    if (isUsingMongoDB()) {
      try {
        const UserPreferences = require("../models/UserPreferences");
        if (UserPreferences) {
          await UserPreferences.updateOne({ userId }, preferences, {
            upsert: true,
          });
        }
      } catch (error) {
        console.error(
          `Error updating preferences in MongoDB for user ${userId}:`,
          error
        );
      }
    } else {
      savePreferences();
    }

    return preferences;
  } catch (error) {
    console.error(`Error updating preferences for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Save all preferences to file
 */
function savePreferences() {
  try {
    const preferences = {};
    preferencesCache.forEach((userPreferences, userId) => {
      preferences[userId] = userPreferences;
    });

    fs.writeFileSync(PREFERENCES_FILE, JSON.stringify(preferences, null, 2));
  } catch (error) {
    console.error("Error saving preferences to file:", error);
  }
}

/**
 * Load all preferences from file
 */
function loadPreferences() {
  try {
    if (fs.existsSync(PREFERENCES_FILE)) {
      const data = fs.readFileSync(PREFERENCES_FILE, "utf8");
      const preferences = JSON.parse(data);

      Object.entries(preferences).forEach(([userId, userPreferences]) => {
        preferencesCache.set(userId, userPreferences);
      });

      console.log(`Loaded ${preferencesCache.size} user preferences from file`);
    } else {
      console.log(
        "No user preferences file found. Starting with empty preferences cache."
      );
      savePreferences(); // Create empty file
    }
  } catch (error) {
    console.error("Error loading preferences from file:", error);
    // Create empty file if there was an error
    savePreferences();
  }
}

/**
 * Get the default currency for a user
 * @param {string} userId - The user's Discord ID
 * @returns {string} The default currency ('osrs' or 'rs3')
 */
async function getDefaultCurrency(userId) {
  const preferences = await getUserPreferences(userId);
  return preferences.defaultCurrency || "osrs";
}

/**
 * Set the default currency for a user
 * @param {string} userId - The user's Discord ID
 * @param {string} currency - The currency to set as default ('osrs' or 'rs3')
 * @returns {Object} The updated preferences
 */
async function setDefaultCurrency(userId, currency) {
  if (currency !== "osrs" && currency !== "rs3") {
    throw new Error('Invalid currency. Must be "osrs" or "rs3".');
  }

  return updateUserPreferences(userId, { defaultCurrency: currency });
}

/**
 * Initialize preferences
 */
function initPreferences() {
  if (!isUsingMongoDB()) {
    loadPreferences();
  }
}

// Call initPreferences on module load
initPreferences();

module.exports = {
  getUserPreferences,
  updateUserPreferences,
  getDefaultCurrency,
  setDefaultCurrency,
  loadPreferences,
  savePreferences,
};
