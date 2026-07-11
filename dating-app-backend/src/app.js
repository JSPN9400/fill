const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const messageRoutes = require('./routes/messageRoutes');
const profileRoutes = require('./routes/profileRoutes');
const discoveryRoutes = require('./routes/discoveryRoutes');
const feelingsRoutes = require('./routes/feelingsRoutes');

const app = express();

// Render (and most hosting platforms) sit behind a reverse proxy — this tells
// Express to trust the X-Forwarded-For header so express-rate-limit can
// correctly identify each user's real IP instead of the proxy's IP.
app.set('trust proxy', 1);

app.use(cors());
// Bumped from 2mb — Feelings photos are sent as base64 (roughly 33% bigger
// than the raw file), so this needs headroom for a compressed photo upload.
app.use(express.json({ limit: '8mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api', discoveryRoutes);
app.use('/api', feelingsRoutes);

// Central error handler - keeps error messages generic to the client (avoid leaking internals)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

module.exports = app;
