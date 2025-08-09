// models/trigger.js
const mongoose = require('mongoose');

const TriggerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  response: {
    type: String,
    required: true
  },
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Trigger = mongoose.connection.readyState === 1 ? 
  (mongoose.models.Trigger || mongoose.model('Trigger', TriggerSchema)) : null;

module.exports = Trigger;