const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const messageRoutes = require('./routes/messageRoutes');
const profileRoutes = require('./routes/profileRoutes');
const discoveryRoutes = require('./routes/discoveryRoutes');

const app = express();

// Render (and most hosting platforms) sit behind a reverse proxy — this tells
// Express to trust the X-Forwarded-For header so express-rate-limit can
// correctly identify each user's real IP instead of the proxy's IP.
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api', discoveryRoutes);

// Central error handler - keeps error messages generic to the client (avoid leaking internals)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

module.exports = app;
