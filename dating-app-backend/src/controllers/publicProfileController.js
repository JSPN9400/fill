const pool = require('../config/db');

async function getPublicProfile(req, res) {
  const { userId } = req.params;

  const userResult = await pool.query(
    `SELECT id, display_name, bio, birth_date, gender, city, state, is_verified, profession,
            (SELECT media_url FROM user_media WHERE user_id = users.id ORDER BY display_order ASC LIMIT 1) AS photo_url
     FROM users WHERE id = $1`,
    [userId]
  );
  if (userResult.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });

  // Tell the frontend whether we've already swiped/matched, so it can show
  // the right action (Like vs Message) instead of letting a double-swipe happen.
  const swipeResult = await pool.query(
    'SELECT swipe_type FROM swipes WHERE swiper_id = $1 AND swipee_id = $2',
    [req.userId, userId]
  );
  const matchResult = await pool.query(
    `SELECT id FROM matches WHERE (user_1_id = $1 AND user_2_id = $2) OR (user_1_id = $2 AND user_2_id = $1)`,
    [req.userId, userId]
  );

  res.json({
    ...userResult.rows[0],
    already_swiped: swipeResult.rows[0]?.swipe_type || null,
    match_id: matchResult.rows[0]?.id || null,
  });
}

module.exports = { getPublicProfile };
