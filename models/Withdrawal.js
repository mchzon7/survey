const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['FAUCETPAY', 'BANK_TRANSFER'],
    required: true
  },
  pointsRequested: {
    type: Number,
    required: true,
    min: 1000
  },
  equivalentAmount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    required: true
  },
  details: {
    faucetpayAddress: { type: String, default: null },
    fullName: { type: String, default: null },
    bankName: { type: String, default: null },
    accountNumber: { type: String, default: null }
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'],
    default: 'PENDING'
  },
  transactionId: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);