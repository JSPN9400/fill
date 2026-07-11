const pool = require('../config/db');

const VALID_TYPES = ['dislike', 'like', 'superlike'];

async function swipe(req, res) {
  const { swipee_id, swipe_type } = req.body;
  const swiperId = Number(req.userId);

  if (!swipee_id || !VALID_TYPES.includes(swipe_type)) {
    return res.status(400).json({ error: 'swipee_id and a valid swipe_type are required' });
  }
  if (Number(swipee_id) === swiperId) {
    return res.status(400).json({ error: "You can't swipe on your own profile" });
  }

  try {
    // 1. Check daily swipe limit based on subscription tier
    const userTierQuery = await pool.query(
      `SELECT t.daily_swipe_limit FROM users u
       JOIN user_tiers t ON u.tier_id = t.id
       WHERE u.id = $1`,
      [swiperId]
    );
    
    if (userTierQuery.rows.length > 0) {
      const limit = userTierQuery.rows[0].daily_swipe_limit;
      if (limit !== -1) {
        // Count swipes since midnight local time (based on server time, or UTC)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const countQuery = await pool.query(
          'SELECT COUNT(*) FROM swipes WHERE swiper_id = $1 AND created_at >= $2',
          [swiperId, todayStart]
        );
        const count = parseInt(countQuery.rows[0].count, 10);
        if (count >= limit) {
          return res.status(403).json({
            error: 'Daily swipe limit reached. Upgrade to a premium tier for unlimited swipes!'
          });
        }
      }
    }

    // 2. Record the swipe
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

  // 3. Check if the other person liked/superliked me back
  const mutual = await pool.query(
    `SELECT id FROM swipes WHERE swiper_id = $1 AND swipee_id = $2 AND swipe_type IN ('like','superlike')`,
    [swipee_id, swiperId]
  );

  if (mutual.rows.length === 0) {
    return res.json({ matched: false });
  }

  // 4. Create a match
  const [user1, user2] = swiperId < Number(swipee_id) ? [swiperId, Number(swipee_id)] : [Number(swipee_id), swiperId];

  const matchResult = await pool.query(
    `INSERT INTO matches (user_1_id, user_2_id) VALUES ($1, $2)
     ON CONFLICT (user_1_id, user_2_id) DO NOTHING
     RETURNING id`,
    [user1, user2]
  );

  const matchId = matchResult.rows[0]?.id;

  if (matchId) {
    try {
      // Get display names of swiper & swipee
      const namesResult = await pool.query(
        'SELECT id, display_name FROM users WHERE id IN ($1, $2)',
        [swiperId, Number(swipee_id)]
      );

      const swiperName = namesResult.rows.find(r => Number(r.id) === swiperId)?.display_name || 'Someone';
      const swipeeName = namesResult.rows.find(r => Number(r.id) === Number(swipee_id))?.display_name || 'Someone';

      // Create in-app notifications
      const { createNotification } = require('../services/notificationService');
      await createNotification(swiperId, 'new_match', { matchId, partnerId: swipee_id, partnerName: swipeeName });
      await createNotification(Number(swipee_id), 'new_match', { matchId, partnerId: swiperId, partnerName: swiperName });
    } catch (notifErr) {
      console.error('Error creating match notifications:', notifErr);
      // Don't crash swipe request if notification fails
    }
  }

  res.json({ matched: true, match_id: matchId });
}

module.exports = { swipe };
