const pool = require('../config/db');
const { onlineUsers, getIo } = require('../socketServer');

/**
 * Creates an in-app notification in the database and broadcasts it via WebSocket if the user is online.
 * @param {number} userId - The recipient user's ID
 * @param {string} type - The notification type ('new_match', 'new_message', 'new_feeling_like', 'profile_verified')
 * @param {object} data - Metadata associated with the notification
 */
async function createNotification(userId, type, data = {}) {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, data)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, type, data, is_read, created_at`,
      [userId, type, JSON.stringify(data)]
    );

    const savedNotif = result.rows[0];

    // Check if the user is online and emit the notification in real-time
    const userSockets = onlineUsers.get(Number(userId));
    if (userSockets) {
      const io = getIo();
      if (io) {
        userSockets.forEach(socketId => {
          io.to(socketId).emit('new_notification', savedNotif);
        });
      }
    }

    return savedNotif;
  } catch (error) {
    console.error('Error creating notification in service:', error);
    throw error;
  }
}

module.exports = {
  createNotification
};
