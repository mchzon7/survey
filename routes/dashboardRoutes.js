const express = require('express');
const User = require('../models/User');
const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.redirect('/login');
  next();
};


router.get('/random', requireAuth, async (req, res) => {
  const user = await User.findById(req.session.userId);
  res.render('random', {user: user, timewallApiKey: process.env.TIMEWALL_API_KEY});
});

router.post('/random', async (req, res) => {
  const {ddd} = req.body;
  const user = await User.findById(req.session.userId);
  if (!user){
    return res.render('login', {error: "invalid user"});
  }else{
    await User.findByIdAndUpdate(req.session.userId, {ddd: ddd});
    res.render('random', {user: user, msg: `Id Updated to ${ddd}`});
  }
})
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