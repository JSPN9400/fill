const pool = require('../config/db');

async function postFeeling(req, res) {
  const { feeling_text, photo_url } = req.body;
  if (!feeling_text?.trim()) return res.status(400).json({ error: 'feeling_text is required' });

  const result = await pool.query(
    `INSERT INTO feelings (user_id, photo_url, feeling_text)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, photo_url, feeling_text, created_at`,
    [req.userId, photo_url || null, feeling_text.trim()]
  );

  res.status(201).json(result.rows[0]);
}

async function getFeed(req, res) {
  const limit = Math.min(parseInt(req.query.limit) || 30, 50);

  const result = await pool.query(
    `SELECT f.id, f.photo_url, f.feeling_text, f.created_at,
            u.id AS user_id, u.display_name, u.is_verified,
            (SELECT media_url FROM user_media WHERE user_id = u.id ORDER BY display_order ASC LIMIT 1) AS avatar_url
     FROM feelings f
     JOIN users u ON u.id = f.user_id
     WHERE f.expires_at > CURRENT_TIMESTAMP
     ORDER BY f.created_at DESC
     LIMIT $1`,
    [limit]
  );

  res.json(result.rows);
}

module.exports = { postFeeling, getFeed };
