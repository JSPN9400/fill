require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSocketServer } = require('./socketServer');

const PORT = process.env.PORT || 5000;

// Create HTTP server from Express app
const server = http.createServer(app);

// Attach Socket.IO to HTTP server
initSocketServer(server);

server.listen(PORT, () => {
  console.log(`Dating app backend running on port ${PORT}`);
});
