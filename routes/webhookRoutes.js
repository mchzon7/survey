const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const PointLog = require('../models/PointLog');

const router = express.Router();

router.all('/api/webhooks/timewall', async (req, res) => {
  try {
    const payload = { ...req.query, ...req.body };

    // Extract values matching TimeWall's exact template
    const userIdStr = payload.userid;
    const externalTxId = payload.txid;
    const pointsAmount = parseFloat(payload.currency);
    const type = payload.type; // e.g., 'credit' or 'chargeback/reversal'

    console.log('TimeWall Postback Payload Received:', payload);

    if (!userIdStr || !externalTxId || isNaN(pointsAmount)) {
      console.error('Invalid Postback Data:', payload);
      return res.status(400).send('ERROR: Missing required fields');
    }

    if (!mongoose.Types.ObjectId.isValid(userIdStr)) {
      console.error(`Invalid User ID format: ${userIdStr}`);
      return res.status(400).send('ERROR: Invalid User ID');
    }

    // Prevent duplicate processing
    const existingLog = await PointLog.findOne({ externalTxId: String(externalTxId) });
    if (existingLog) {
      console.log(`Transaction ${externalTxId} already processed.`);
      return res.status(200).send('1');
    }

    // Handle Chargebacks/Reversals if sent by TimeWall
    const pointsToApply = (type && type.toLowerCase() === 'chargeback') ? -Math.abs(pointsAmount) : pointsAmount;

    // Credit/Deduct points in MongoDB
    const updatedUser = await User.findByIdAndUpdate(
      userIdStr,
      { $inc: { points: pointsToApply } },
      { new: true }
    );

    if (!updatedUser) {
      console.error(`User not found: ${userIdStr}`);
      return res.status(404).send('ERROR: User not found');
    }

    // Record the transaction log
    await PointLog.create({
      userId: updatedUser._id,
      points: pointsToApply,
      source: 'TIMEWALL',
      externalTxId: String(externalTxId)
    });

    console.log(`Successfully updated ${pointsToApply} points for ${updatedUser.username}`);
    return res.status(200).send('1');

  } catch (error) {
    console.error('TimeWall Webhook Error:', error);
    return res.status(500).send('ERROR: Internal Server Error');
  }
});

module.exports = router;