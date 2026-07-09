const pool = require('../config/db');

async function updateBio(req, res) {
  const { bio } = req.body;

  const result = await pool.query(
    'UPDATE users SET bio = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, bio',
    [bio, req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

  res.json(result.rows[0]);
}

module.exports = { updateBio };
