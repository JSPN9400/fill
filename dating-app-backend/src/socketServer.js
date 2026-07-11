const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const pool = require('./config/db');

const onlineUsers = new Map();
let ioInstance = null;

function initSocketServer(server) {
  const io = socketIO(server, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Handshake authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

    try {
      const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
      socket.userId = Number(decoded.userId);
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`User connected to socket: ${userId} (socketId: ${socket.id})`);

    // Add to online users
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Broadcast online status to anyone interested
    socket.broadcast.emit('user_status', { userId, status: 'online' });

    // Join match room
    socket.on('join_match', async ({ matchId }, ack) => {
      try {
        const result = await pool.query(
          'SELECT id FROM matches WHERE id = $1 AND (user_1_id = $2 OR user_2_id = $3)',
          [matchId, userId, userId]
        );

        if (result.rows.length === 0) {
          if (ack) ack({ error: 'Unauthorized to join this match chat' });
          return;
        }

        socket.join(`match_${matchId}`);
        console.log(`Socket ${socket.id} joined room match_${matchId}`);
        if (ack) ack({ success: true });
      } catch (err) {
        console.error('Error joining match room:', err);
        if (ack) ack({ error: 'Server error' });
      }
    });

    // Send Message
    socket.on('send_message', async ({ matchId, messageText }, ack) => {
      if (!messageText || messageText.trim() === '') {
        if (ack) ack({ error: 'Message text is empty' });
        return;
      }

      try {
        const matchCheck = await pool.query(
          'SELECT user_1_id, user_2_id FROM matches WHERE id = $1 AND (user_1_id = $2 OR user_2_id = $3)',
          [matchId, userId, userId]
        );

        if (matchCheck.rows.length === 0) {
          if (ack) ack({ error: 'Unauthorized to send messages to this match' });
          return;
        }

        // Save to Database
        const dbResult = await pool.query(
          `INSERT INTO messages (match_id, sender_id, message_text)
           VALUES ($1, $2, $3)
           RETURNING id, match_id, sender_id, message_text, is_read, created_at`,
          [matchId, userId, messageText]
        );

        const savedMsg = dbResult.rows[0];

        // Broadcast to room
        io.to(`match_${matchId}`).emit('new_message', savedMsg);

        // Also notify recipient if they are not in the room but are online
        const partnerId = Number(matchCheck.rows[0].user_1_id) === userId 
          ? Number(matchCheck.rows[0].user_2_id) 
          : Number(matchCheck.rows[0].user_1_id);

        const partnerSockets = onlineUsers.get(partnerId);
        if (partnerSockets) {
          partnerSockets.forEach(sockId => {
            const socketsInRoom = io.sockets.adapter.rooms.get(`match_${matchId}`);
            if (!socketsInRoom || !socketsInRoom.has(sockId)) {
              io.to(sockId).emit('message_received_notification', {
                matchId,
                message: savedMsg
              });
            }
          });
        }

        if (ack) ack({ success: true, message: savedMsg });
      } catch (err) {
        console.error('Error saving/sending socket message:', err);
        if (ack) ack({ error: 'Server error saving message' });
      }
    });

    // Typing Indicators
    socket.on('typing', ({ matchId, isTyping }) => {
      socket.to(`match_${matchId}`).emit('typing', { matchId, userId, isTyping });
    });

    // Mark Messages as Read
    socket.on('message_read', async ({ matchId }, ack) => {
      try {
        await pool.query(
          'UPDATE messages SET is_read = TRUE WHERE match_id = $1 AND sender_id != $2 AND is_read = FALSE',
          [matchId, userId]
        );
        socket.to(`match_${matchId}`).emit('messages_read', { matchId });
        if (ack) ack({ success: true });
      } catch (err) {
        console.error('Error marking messages as read via socket:', err);
        if (ack) ack({ error: 'Server error' });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id} (user: ${userId})`);
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          socket.broadcast.emit('user_status', { userId, status: 'offline' });
        }
      }
    });
  });

  ioInstance = io;
  return io;
}

function getIo() {
  return ioInstance;
}

module.exports = { initSocketServer, onlineUsers, getIo };
