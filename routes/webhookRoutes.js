const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const PointLog = require('../models/PointLog');

const router = express.Router();

router.post('/api/webhooks/timewall', async (req, res) => {
  try {
    const { user_id, points, tx_id, signature } = req.body;

    // Optional Timewall HMAC Verification if signature provided
    if (signature && process.env.TIMEWALL_SECRET_KEY) {
      const computedSignature = crypto
        .createHmac('sha256', process.env.TIMEWALL_SECRET_KEY)
        .update(`${user_id}:${points}:${tx_id}`)
        .digest('hex');

      if (computedSignature !== signature) {
        return res.status(400).json({ error: 'Invalid Webhook Signature' });
      }
    }

    const pointsParsed = parseFloat(points);
    if (!user_id || isNaN(pointsParsed) || !tx_id) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Check duplicate credited postback
    const existingLog = await PointLog.findOne({ externalTxId: tx_id });
    if (existingLog) {
      return res.status(200).json({ message: 'Transaction already processed' });
    }

    // Idempotent point credit
    const updatedUser = await User.findByIdAndUpdate(
      user_id,
      { $inc: { points: pointsParsed } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Record Point Log
    await PointLog.create({
      userId: user_id,
      points: pointsParsed,
      source: 'TIMEWALL',
      externalTxId: tx_id
    });

    return res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;