const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const router = express.Router();

// Middleware to redirect logged in users
const redirectIfAuth = (req, res, next) => {
  if (req.session.userId) return res.redirect('/dashboard');
  next();
};

router.get('/register', redirectIfAuth, (req, res) => {
  res.render('register', { error: null });
});

router.post('/register', redirectIfAuth, async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.render('register', { error: 'Username or Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      email,
      password: hashedPassword
    });

    await user.save();
    req.session.userId = user._id;
    res.redirect('/dashboard');
  } catch (error) {
    res.render('register', { error: 'Error creating account. Try again.' });
  }
});

router.get('/login', redirectIfAuth, (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', redirectIfAuth, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.render('login', { error: 'Invalid email or password.' });
    }

    req.session.userId = user._id;
    res.redirect('/dashboard');
  } catch (error) {
    res.render('login', { error: 'Login error occurred.' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;