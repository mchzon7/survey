require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const connectDB = require('./config/db');
let MongoStore = require('connect-mongo');

// Resolve CommonJS export structure for connect-mongo v6
if (MongoStore.default) {
  MongoStore = MongoStore.default;
}

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

// Use MongoStore default export or standard constructor fallback

app.use(session({
  secret: process.env.SESSION_SECRET || 'your_session_secret_key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 14 * 24 * 60 * 60 // 14 days
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

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