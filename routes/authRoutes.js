const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const router = express.Router();

// Middleware to redirect logged in users


router.get('/register', (req, res) => {
  res.render('register', { error: null });
});

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const email = String(req.body.email || '').trim().toLowerCase();
    
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
    req.session.save((sessionError) => {
      if (sessionError) {
        console.error('Registration session save error:', sessionError);
        return res.status(500).render('register', { error: 'Account created, but login could not be started.' });
      }
      res.redirect('/dashboard');
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.render('register', { error: 'Error creating account. Try again.' });
  }
});

router.get('/login',(req, res) => {
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.render('login', { error: 'Invalid email or password.' });
    }

    req.session.userId = user._id;
    req.session.save((sessionError) => {
      if (sessionError) {
        console.error('Login session save error:', sessionError);
        return res.status(500).render('login', { error: 'Login could not be completed. Please try again.' });
      }
      res.redirect('/dashboard');
    });
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { error: 'Login error occurred.' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
