const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/authRoutes');
const messageRoutes = require('./routes/messageRoutes');
const profileRoutes = require('./routes/profileRoutes');
const discoveryRoutes = require('./routes/discoveryRoutes');
const feelingsRoutes = require('./routes/feelingsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

// Trust proxy for Render/reverse-proxies
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// HTTP request logger
app.use(morgan('dev'));

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Allow server-to-server or mobile app
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};
app.use(cors(corsOptions));

// JSON Parser with 8mb limit (for photo base64 uploads in MVP)
app.use(express.json({ limit: '8mb' }));

// Global API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per 15 minutes
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', discoveryRoutes);
app.use('/api', feelingsRoutes);

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

module.exports = app;
