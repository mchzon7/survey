const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const PointLog = require('../models/PointLog');
const transporter = require('../config/mailer');

const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.redirect('/login');
  next();
};

router.get('/withdraw', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    res.render('withdraw', { user, error: null, success: null });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

router.post('/withdraw', requireAuth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { withdrawalType, points, faucetpayAddress, fullName, bankName, accountNumber, currency } = req.body;
    const pointsNum = parseInt(points, 10);

    if (isNaN(pointsNum) || pointsNum < 1000) {
      await session.abortTransaction();
      session.endSession();
      const user = await User.findById(req.session.userId);
      return res.render('withdraw', { user, error: 'Minimum withdrawal requirement is 1,000 points.', success: null });
    }

    const user = await User.findById(req.session.userId).session(session);
    if (user.points < pointsNum) {
      await session.abortTransaction();
      session.endSession();
      return res.render('withdraw', { user, error: 'Insufficient point balance.', success: null });
    }

    // 1 Point = $0.001 USD conversion baseline
    const equivalentAmount = pointsNum * 0.001;

    if (withdrawalType === 'FAUCETPAY') {
      if (!faucetpayAddress) {
        await session.abortTransaction();
        session.endSession();
        return res.render('withdraw', { user, error: 'FaucetPay address/email is required.', success: null });
      }

      // Execute API Call to FaucetPay
      const fpParams = new URLSearchParams({
        api_key: process.env.FAUCETPAY_API_KEY,
        to: faucetpayAddress,
        amount: equivalentAmount,
        currency: currency || 'BTC',
        referral: 'false'
      });

      const fpResponse = await axios.post('https://faucetpay.io/api/v1/send', fpParams.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (fpResponse.data && fpResponse.data.status === 200) {
        user.points -= pointsNum;
        user.totalWithdrawn += pointsNum;
        await user.save({ session });

        const withdrawal = new Withdrawal({
          userId: user._id,
          type: 'FAUCETPAY',
          pointsRequested: pointsNum,
          equivalentAmount,
          currency: currency || 'BTC',
          details: { faucetpayAddress },
          status: 'COMPLETED',
          transactionId: fpResponse.data.payout_id || 'FP-' + Date.now()
        });
        await withdrawal.save({ session });

        await new PointLog({
          userId: user._id,
          points: -pointsNum,
          source: 'WITHDRAWAL_FAUCETPAY'
        }).save({ session });

        await session.commitTransaction();
        session.endSession();

        return res.render('withdraw', { user, error: null, success: 'FaucetPay instant payout successful!' });
      } else {
        await session.abortTransaction();
        session.endSession();
        return res.render('withdraw', { user, error: `FaucetPay Error: ${fpResponse.data.message || 'Transaction failed'}`, success: null });
      }

    } else if (withdrawalType === 'BANK_TRANSFER') {
      if (!fullName || !bankName || !accountNumber) {
        await session.abortTransaction();
        session.endSession();
        return res.render('withdraw', { user, error: 'Please fill in all bank details.', success: null });
      }

      // Deduct points into Escrow
      user.points -= pointsNum;
      await user.save({ session });

      const withdrawal = new Withdrawal({
        userId: user._id,
        type: 'BANK_TRANSFER',
        pointsRequested: pointsNum,
        equivalentAmount,
        currency: currency || 'USD',
        details: { fullName, bankName, accountNumber },
        status: 'PENDING'
      });
      await withdrawal.save({ session });

      await new PointLog({
        userId: user._id,
        points: -pointsNum,
        source: 'WITHDRAWAL_BANK_ESCROW'
      }).save({ session });

      await session.commitTransaction();
      session.endSession();

      // Trigger Email to Admin
      const mailOptions = {
        from: process.env.SMTP_FROM,
        to: process.env.ADMIN_EMAIL,
        subject: `New Bank Withdrawal Request - ${user.username}`,
        html: `
          <h2>New Withdrawal Request Pending Approval</h2>
          <p><strong>User ID:</strong> ${user._id}</p>
          <p><strong>Username:</strong> ${user.username}</p>
          <p><strong>Requested Points:</strong> ${pointsNum}</p>
          <p><strong>Equivalent Value:</strong> $${equivalentAmount.toFixed(2)} (${currency || 'USD'})</p>
          <h3>Bank Details:</h3>
          <ul>
            <li><strong>Full Name:</strong> ${fullName}</li>
            <li><strong>Bank Name:</strong> ${bankName}</li>
            <li><strong>Account Number:</strong> ${accountNumber}</li>
          </ul>
          <p><strong>Request Time:</strong> ${new Date().toLocaleString()}</p>
        `
      };

      transporter.sendMail(mailOptions, (err) => {
        if (err) console.error('Admin Notification Mail Error:', err);
      });

      return res.render('withdraw', { user, error: null, success: 'Bank withdrawal request submitted and pending manual review.' });
    } else {
      await session.abortTransaction();
      session.endSession();
      return res.render('withdraw', { user, error: 'Invalid withdrawal method selected.', success: null });
    }

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    const user = await User.findById(req.session.userId);
    res.render('withdraw', { user, error: 'Processing error occurred. Try again.', success: null });
  }
});

// Admin Route: View Pending Requests
router.get('/admin/withdrawals', async (req, res) => {
  try {
    const pendingWithdrawals = await Withdrawal.find({ status: 'PENDING' }).populate('userId');
    res.render('admin-withdrawals', { withdrawals: pendingWithdrawals, message: null });
  } catch (err) {
    res.status(500).send('Admin Error');
  }
});

// Admin Route: Process Action
router.post('/admin/withdrawals/action', async (req, res) => {
  const { withdrawalId, action } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const withdrawal = await Withdrawal.findById(withdrawalId).session(session);
    if (!withdrawal || withdrawal.status !== 'PENDING') {
      await session.abortTransaction();
      session.endSession();
      return res.redirect('/admin/withdrawals');
    }

    const user = await User.findById(withdrawal.userId).session(session);

    if (action === 'APPROVE') {
      withdrawal.status = 'APPROVED';
      user.totalWithdrawn += withdrawal.pointsRequested;
      await withdrawal.save({ session });
      await user.save({ session });
    } else if (action === 'REJECT') {
      withdrawal.status = 'REJECTED';
      user.points += withdrawal.pointsRequested; // Refund points
      await withdrawal.save({ session });
      await user.save({ session });

      await new PointLog({
        userId: user._id,
        points: withdrawal.pointsRequested,
        source: 'WITHDRAWAL_REFUND'
      }).save({ session });
    }

    await session.commitTransaction();
    session.endSession();
    res.redirect('/admin/withdrawals');
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).send('Failed to execute admin action.');
  }
});

module.exports = router;