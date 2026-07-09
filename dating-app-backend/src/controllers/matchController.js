const pool = require('../config/db');

async function listMatches(req, res) {
  const userId = req.userId;

  const result = await pool.query(
    `SELECT
        m.id AS match_id,
        m.created_at AS matched_at,
        u.id AS other_user_id,
        u.display_name,
        u.is_verified,
        (SELECT media_url FROM user_media WHERE user_id = u.id ORDER BY display_order ASC LIMIT 1) AS photo_url,
        (SELECT message_text FROM messages WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT created_at FROM messages WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1) AS last_message_at
     FROM matches m
     JOIN users u ON u.id = (CASE WHEN m.user_1_id = $1 THEN m.user_2_id ELSE m.user_1_id END)
     WHERE m.user_1_id = $1 OR m.user_2_id = $1
     ORDER BY COALESCE(
       (SELECT created_at FROM messages WHERE match_id = m.id ORDER BY created_at DESC LIMIT 1),
       m.created_at
     ) DESC`,
    [userId]
  );

  res.json(result.rows);
}

module.exports = { listMatches };
