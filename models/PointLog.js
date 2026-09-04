const mongoose = require('mongoose');

const pointLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  points: {
    type: Number,
    required: true
  },
  source: {
    type: String,
    required: true // e.g., 'TIMEWALL', 'WITHDRAWAL_REFUND', 'WITHDRAWAL_DEDUCTION', 'BONUS'
  },
  externalTxId: {
    type: String,
    sparse: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('PointLog', pointLogSchema);