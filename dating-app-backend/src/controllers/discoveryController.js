const pool = require('../config/db');

/**
 * Returns a batch of candidate profiles for the logged-in user to swipe on.
 * Filters: gender preferences, age bounds, distance (Haversine formula), and excludes swiped profiles.
 * Sorts by number of shared interests and registration date.
 */
async function getFeed(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 30);
  const ageMin = parseInt(req.query.age_min, 10) || 18;
  const ageMax = parseInt(req.query.age_max, 10) || 99;
  const lat = parseFloat(req.query.latitude);
  const lng = parseFloat(req.query.longitude);
  const maxDistance = parseFloat(req.query.max_distance_km) || 50;

  try {
    const me = await pool.query('SELECT gender, interested_in, interests FROM users WHERE id = $1', [req.userId]);
    if (me.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const { gender: myGender, interested_in: myGenderPreference, interests: myInterests } = me.rows[0];

    // Calculate birth date bounds for age filter
    const today = new Date();
    const maxBirthDate = new Date(today.getFullYear() - ageMin, today.getMonth(), today.getDate());
    const minBirthDate = new Date(today.getFullYear() - ageMax - 1, today.getMonth(), today.getDate());

    let queryParams = [req.userId, myGenderPreference, myGender, limit, myInterests || [], minBirthDate, maxBirthDate];
    let distanceSelect = '';
    let distanceFilter = '';

    if (!isNaN(lat) && !isNaN(lng)) {
      const latIndex = queryParams.length + 1;
      const lngIndex = queryParams.length + 2;
      const distIndex = queryParams.length + 3;
      
      queryParams.push(lat, lng, maxDistance);

      distanceSelect = `, (6371 * acos(LEAST(1.0, GREATEST(-1.0, cos(radians($${latIndex})) * cos(radians(u.location_latitude)) * cos(radians(u.location_longitude) - radians($${lngIndex})) + sin(radians($${latIndex})) * sin(radians(u.location_latitude)))))) AS distance`;
      distanceFilter = ` AND (u.location_latitude IS NOT NULL AND u.location_longitude IS NOT NULL AND (6371 * acos(LEAST(1.0, GREATEST(-1.0, cos(radians($${latIndex})) * cos(radians(u.location_latitude)) * cos(radians(u.location_longitude) - radians($${lngIndex})) + sin(radians($${latIndex})) * sin(radians(u.location_latitude)))))) <= $${distIndex})`;
    }

    const query = `
      SELECT u.id, u.display_name, u.bio, u.birth_date, u.gender, u.city, u.state, u.is_verified, u.interests, u.profession,
             (SELECT media_url FROM user_media WHERE user_id = u.id ORDER BY display_order ASC LIMIT 1) AS photo_url,
             (SELECT count(*) FROM unnest(u.interests) i WHERE i = ANY($5::text[])) AS shared_interest_count
             ${distanceSelect}
      FROM users u
      WHERE u.id != $1
        AND u.gender = ANY($2::gender_enum[])
        AND $3::gender_enum = ANY(u.interested_in)
        AND u.birth_date BETWEEN $6 AND $7
        AND u.id NOT IN (SELECT swipee_id FROM swipes WHERE swiper_id = $1)
        ${distanceFilter}
      ORDER BY shared_interest_count DESC, u.created_at DESC
      LIMIT $4
    `;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching discovery feed:', error);
    res.status(500).json({ error: 'Server error fetching discovery feed' });
  }
}

module.exports = { getFeed };
