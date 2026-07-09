const pool = require('../config/db');

const VALID_TYPES = ['dislike', 'like', 'superlike'];

async function swipe(req, res) {
  const { swipee_id, swipe_type } = req.body;
  const swiperId = req.userId;

  if (!swipee_id || !VALID_TYPES.includes(swipe_type)) {
    return res.status(400).json({ error: 'swipee_id and a valid swipe_type are required' });
  }
  if (Number(swipee_id) === Number(swiperId)) {
    return res.status(400).json({ error: "You can't swipe on your own profile" });
  }

  // Record the swipe. The UNIQUE(swiper_id, swipee_id) constraint stops
  // someone swiping twice on the same profile.
  try {
    await pool.query(
      'INSERT INTO swipes (swiper_id, swipee_id, swipe_type) VALUES ($1, $2, $3)',
      [swiperId, swipee_id, swipe_type]
    );
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You already swiped on this profile' });
    }
    throw err;
  }

  // Dislikes never create a match
  if (swipe_type === 'dislike') {
    return res.json({ matched: false });
  }

  // Check if the other person already liked/superliked me back
  const mutual = await pool.query(
    `SELECT id FROM swipes WHERE swiper_id = $1 AND swipee_id = $2 AND swipe_type IN ('like','superlike')`,
    [swipee_id, swiperId]
  );

  if (mutual.rows.length === 0) {
    return res.json({ matched: false });
  }

  // It's a match — matches.user_1_id must be the smaller id (schema constraint)
  const [user1, user2] = swiperId < swipee_id ? [swiperId, swipee_id] : [swipee_id, swiperId];

  const matchResult = await pool.query(
    `INSERT INTO matches (user_1_id, user_2_id) VALUES ($1, $2)
     ON CONFLICT (user_1_id, user_2_id) DO NOTHING
     RETURNING id`,
    [user1, user2]
  );

  const matchId = matchResult.rows[0]?.id;
  res.json({ matched: true, match_id: matchId });
}

module.exports = { swipe };
