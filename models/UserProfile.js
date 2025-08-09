// models/UserProfile.js
const mongoose = require('mongoose');

const UserProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  twitchUsername: { type: String, default: null },
});

module.exports = mongoose.models.UserProfile || mongoose.model('UserProfile', UserProfileSchema);

// This schema defines the UserProfile model used to store user-specific data such as Twitch usernames.
// It ensures that each user has a unique profile and allows for easy retrieval and updates.