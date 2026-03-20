// models/Mood.js
// ─── MODEL (M in MVC) ─────────────────────────────────────────────────────────
// Defines the data structure for mood entries stored in MongoDB.
// Fields mirror the data types specified in the project proposal.

const mongoose = require('mongoose');

const moodSchema = new mongoose.Schema({

  // Child being tracked
  childName: {
    type: String,
    required: [true, 'Child name is required'],
    trim: true
  },

  // Emotion label (e.g., "Happy", "Anxious", "Overwhelmed")
  emotion: {
    type: String,
    required: [true, 'Emotion is required'],
    trim: true
  },

  // Intensity on a scale of 1–10
  intensity: {
    type: Number,
    required: [true, 'Intensity is required'],
    min: [1, 'Intensity must be at least 1'],
    max: [10, 'Intensity must be at most 10']
  },

  // Free-text description of what triggered the emotion
  triggerDescription: {
    type: String,
    trim: true,
    default: ''
  },

  // Who recorded this entry
  recordedBy: {
    type: String,
    enum: ['Parent', 'Caretaker'],
    required: [true, 'Recorder role is required']
  },

  // Auto-captured timestamp of when the emotion occurred
  occurredAt: {
    type: Date,
    default: Date.now
  }

}, {
  timestamps: true  // adds createdAt and updatedAt automatically
});

module.exports = mongoose.model('Mood', moodSchema);
