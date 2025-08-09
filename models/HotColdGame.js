// models/HotColdGame.js
const mongoose = require("mongoose");

// Define the result schema separately
const ResultSchema = new mongoose.Schema(
  {
    color: String,
    type: String,
  },
  { _id: false }
); // Disable _id for subdocument

const HotColdGameSchema = new mongoose.Schema({
  id: String,
  hostId: String,
  bets: [
    {
      playerId: String,
      betType: String,
      amount: String,
      currency: String,
    },
  ],
  result: ResultSchema, // Use the defined schema
  createdAt: Date,
  endedAt: Date,
});

// Check if the model exists before creating it
let HotColdGame;
try {
  HotColdGame = mongoose.model("HotColdGame");
} catch (e) {
  HotColdGame = mongoose.model("HotColdGame", HotColdGameSchema);
}

module.exports = HotColdGame;
