const pool = require('../config/db');

// Confirms the logged-in user is actually part of this match before letting
// them read or send messages in it.
async function assertUserInMatch(matchId, userId) {
  const result = await pool.query(
    'SELECT id FROM matches WHERE id = $1 AND (user_1_id = $2 OR user_2_id = $2)',
    [matchId, userId]
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

  const allowed = await assertUserInMatch(matchId, req.userId);
  if (!allowed) return res.status(403).json({ error: 'You are not part of this match' });

  const result = await pool.query(
    `SELECT id, sender_id, message_text, is_read, created_at
     FROM messages WHERE match_id = $1 ORDER BY created_at ASC LIMIT 200`,
    [matchId]
  );
  res.json(result.rows);
}

module.exports = { sendMessage, listMessages };
