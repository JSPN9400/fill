const pool = require('../config/db');

// Confirms the logged-in user is actually part of this match before letting
// them read or send messages in it.
async function assertUserInMatch(matchId, userId) {
  const result = await pool.query(
    'SELECT id FROM matches WHERE id = $1 AND (user_1_id = $2 OR user_2_id = $3)',
    [matchId, userId, userId]
  );
  return result.rows.length > 0;
}

async function sendMessage(req, res) {
  const { matchId } = req.params;
  const { message_text } = req.body;
  if (!message_text?.trim()) return res.status(400).json({ error: 'message_text is required' });

  const allowed = await assertUserInMatch(matchId, req.userId);
  if (!allowed) return res.status(403).json({ error: 'You are not part of this match' });

  const result = await pool.query(
    `INSERT INTO messages (match_id, sender_id, message_text)
     VALUES ($1, $2, $3) RETURNING id, match_id, sender_id, message_text, is_read, created_at`,
    [matchId, req.userId, message_text.trim()]
  );

  res.status(201).json(result.rows[0]);
}

async function listMessages(req, res) {
  const { matchId } = req.params;
  const limit = parseInt(req.query.limit, 10) || 50;
  const before = parseInt(req.query.before, 10) || null;

  const allowed = await assertUserInMatch(matchId, req.userId);
  if (!allowed) return res.status(403).json({ error: 'You are not part of this match' });

  let query = `SELECT id, sender_id, message_text, is_read, created_at
               FROM messages 
               WHERE match_id = $1`;
  const params = [matchId];

  if (before) {
    query += ` AND id < $2`;
    params.push(before);
  }

  query += ` ORDER BY id DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  try {
    const result = await pool.query(query, params);
    // Reverse DESC order back to ASC chronological order for chat rendering
    res.json(result.rows.reverse());
  } catch (error) {
    console.error('Error listing messages:', error);
    res.status(500).json({ error: 'Server error fetching messages' });
  }
}

async function markMessagesRead(req, res) {
  const { matchId } = req.params;

  try {
    const allowed = await assertUserInMatch(matchId, req.userId);
    if (!allowed) return res.status(403).json({ error: 'You are not part of this match' });

    await pool.query(
      'UPDATE messages SET is_read = TRUE WHERE match_id = $1 AND sender_id != $2 AND is_read = FALSE',
      [matchId, req.userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages read:', error);
    res.status(500).json({ error: 'Server error marking messages as read' });
  }
}

module.exports = { sendMessage, listMessages, markMessagesRead };
