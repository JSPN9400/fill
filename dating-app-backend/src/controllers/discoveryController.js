const pool = require('../config/db');

/**
 * Returns a batch of candidate profiles for the logged-in user to swipe on.
 * Excludes: self, anyone already swiped on, and (best-effort) only shows
 * people whose gender matches what I'm interested in, AND who are
 * interested in my gender too — so the feed is mutually relevant.
 * Within that pool, profiles that share more of my hobby/topic interests
 * are ranked higher — a simple first pass at "smart" matching.
 */
async function getFeed(req, res) {
  const limit = Math.min(parseInt(req.query.limit) || 10, 30);

  const me = await pool.query('SELECT gender, interested_in, interests FROM users WHERE id = $1', [req.userId]);
  if (me.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  const { gender: myGender, interested_in: myGenderPreference, interests: myInterests } = me.rows[0];

  const result = await pool.query(
    `SELECT u.id, u.display_name, u.bio, u.birth_date, u.gender, u.city, u.state, u.is_verified, u.interests, u.profession,
            (SELECT media_url FROM user_media WHERE user_id = u.id ORDER BY display_order ASC LIMIT 1) AS photo_url,
            (SELECT count(*) FROM unnest(u.interests) i WHERE i = ANY($5::text[])) AS shared_interest_count
     FROM users u
     WHERE u.id != $1
       AND u.gender = ANY($2::gender_enum[])
       AND $3::gender_enum = ANY(u.interested_in)
       AND u.id NOT IN (SELECT swipee_id FROM swipes WHERE swiper_id = $1)
     ORDER BY shared_interest_count DESC, u.created_at DESC
     LIMIT $4`,
    [req.userId, myGenderPreference, myGender, limit, myInterests || []]
  );

  res.json(result.rows);
}

module.exports = { getFeed };
