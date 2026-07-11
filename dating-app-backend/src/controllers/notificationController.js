const pool = require('../config/db');

async function listNotifications(req, res) {
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = parseInt(req.query.offset, 10) || 0;

  try {
    const result = await pool.query(
      `SELECT id, type, data, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.userId, limit, offset]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Server error fetching notifications' });
  }
}

async function markNotificationsRead(req, res) {
  const { notificationIds } = req.body; // Expects array of IDs

  try {
    let query = 'UPDATE notifications SET is_read = TRUE WHERE user_id = $1';
    const params = [req.userId];

    if (Array.isArray(notificationIds) && notificationIds.length > 0) {
      // Mark specific notifications as read
      query += ` AND id = ANY($2)`;
      params.push(notificationIds);
    } else {
      // If no array or empty array provided, mark ALL as read
      query += ' AND is_read = FALSE';
    }

    await pool.query(query, params);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ error: 'Server error updating notifications' });
  }
}

async function getUnreadCount(req, res) {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.userId]
    );
    res.json({ unread_count: parseInt(result.rows[0].count, 10) });
  } catch (error) {
    console.error('Error fetching unread notifications count:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  listNotifications,
  markNotificationsRead,
  getUnreadCount
};
