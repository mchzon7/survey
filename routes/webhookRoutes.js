const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const PointLog = require('../models/PointLog');

const router = express.Router();

// 1. Official TimeWall Server IPs
const ALLOWED_TIMEWALL_IPS = [
  '18.156.132.55',
  '51.81.120.73',
  '142.111.248.18'
];

router.all('/api/webhooks/timewall', async (req, res) => {
  try {
    const payload = { ...req.query, ...req.body };

    // Determine incoming client IP (accounts for Render proxy headers)
    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
      .split(',')[0]
      .trim();

    console.log('--- TIMEWALL INCOMING POSTBACK ---');
    console.log('Incoming IP:', clientIp);
    console.log('Payload:', payload);

    // 2. Validate Request IP
    if (!ALLOWED_TIMEWALL_IPS.includes(clientIp)) {
      console.error(`SECURITY ERROR: Unauthorized IP address '${clientIp}' attempt.`);
      return res.status(403).send('ERROR: Unauthorized IP address');
    }

    const { userid, txid, revenue, currency, hash, type } = payload;

    // 3. Extract and Validate Required Parameters
    const userIdStr = userid ? String(userid).trim().replace(/['"]/g, '') : null;
    const externalTxId = txid;
    const pointsAmount = parseFloat(currency);

    if (!userIdStr || !externalTxId || isNaN(pointsAmount) || !revenue || !hash) {
      console.error('FAILED: Missing required parameters in payload.');
      return res.status(200).send('ERROR_MISSING_PARAMS');
    }

    // 4. SHA-256 Hash Signature Verification
    const secretKey = process.env.TIMEWALL_SECRET_KEY;
    if (secretKey) {
      // Must use raw revenue string directly without rounding/formatting
      const rawRevenueStr = String(revenue); 
      const computedHash = crypto
        .createHash('sha256')
        .update(userIdStr + rawRevenueStr + secretKey)
        .digest('hex');

      if (computedHash.toLowerCase() !== String(hash).toLowerCase()) {
        console.error(`SECURITY ERROR: Hash Mismatch. Received: ${hash}, Expected: ${computedHash}`);
        return res.status(200).send('ERROR_INVALID_HASH');
      }
    } else {
      console.warn('WARNING: TIMEWALL_SECRET_KEY is missing in environment variables. Hash check skipped.');
    }

    // 5. Verify Mongo ObjectId Format
    if (!mongoose.Types.ObjectId.isValid(userIdStr)) {
      console.error(`FAILED: '${userIdStr}' is not a valid ObjectId.`);
      return res.status(200).send('ERROR_INVALID_OBJECT_ID');
    }

    // 6. Prevent Duplicate Transaction Credit
    const existingLog = await PointLog.findOne({ externalTxId: String(externalTxId) });
    if (existingLog) {
      console.log(`Transaction ${externalTxId} previously credited.`);
      return res.status(200).send('1');
    }

    // Handle Chargebacks or Credits
    const pointsToApply = (type && String(type).toLowerCase() === 'chargeback') 
      ? -Math.abs(pointsAmount) 
      : pointsAmount;

    // 7. Atomic Point Balance Update in MongoDB
    const updatedUser = await User.findByIdAndUpdate(
      userIdStr,
      { $inc: { points: pointsToApply } },
      { new: true }
    );

    if (!updatedUser) {
      console.error(`FAILED: User ID '${userIdStr}' not found in database.`);
      return res.status(200).send('ERROR_USER_NOT_FOUND');
    }

    // 8. Create Transaction Log Record
    await PointLog.create({
      userId: updatedUser._id,
      points: pointsToApply,
      source: 'TIMEWALL',
      externalTxId: String(externalTxId)
    });

    console.log(`SUCCESS: Credited ${pointsToApply} points to user ${updatedUser.username} (${updatedUser._id}).`);
    return res.status(200).send('1');

  } catch (error) {
    console.error('CRITICAL TIMEWALL ERROR:', error);
    return res.status(500).send('SERVER_ERROR');
  }
});

module.exports = router;