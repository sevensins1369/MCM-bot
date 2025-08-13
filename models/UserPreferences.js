// models/UserPreferences.js
const mongoose = require("mongoose");

const UserPreferencesSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  defaultCurrency: {
    type: String,
    enum: ["osrs", "rs3"],
    default: "osrs",
  },
  twitchUsername: {
    type: String,
    default: null,
  },
  flowerPreference: {
    type: String,
    default: "random",
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Create indexes for better performance
UserPreferencesSchema.index({ userId: 1 });

const UserPreferences =
  mongoose.connection.readyState === 1
    ? mongoose.models.UserPreferences ||
      mongoose.model("UserPreferences", UserPreferencesSchema)
    : null;

module.exports = UserPreferences;
