require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();

// Database Connection
connectDB();

// Views Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express Session Configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 Day
      httpOnly: true
    }
  })
);

// Route Declarations
app.use(authRoutes);
app.use(dashboardRoutes);
app.use(withdrawalRoutes);
app.use(webhookRoutes);

// Root Fallback
app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.redirect('/login');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));