const express = require('express');
const axios = require('axios');
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

    let offers = [];
    try {
      // Server-side call to fetch raw JSON offer feed
      const response = await axios.get('https://timewall.io/api/v1/offers', {
        headers: {
          'X-Api-Key': process.env.TIMEWALL_API_KEY
        },
        params: {
          user_id: user._id.toString()
        },
        timeout: 4000
      });
      offers = response.data.offers || response.data || [];
    } catch (apiError) {
      console.error('Failed to fetch Timewall JSON feed:', apiError.message);
      // Fallback empty array on timeout or API error
      offers = [];
    }

    res.render('dashboard', {
      user,
      offers
    });
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;