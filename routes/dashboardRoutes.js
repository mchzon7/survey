const express = require('express');
const User = require('../models/User');
const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.redirect('/login');
  next();
};

router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect('/login');

    res.render('dashboard', {
      user,
      timewallApiKey: process.env.TIMEWALL_API_KEY
    });
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;