const pool = require('../config/db');
const storageService = require('../services/storageService');

async function getMyProfile(req, res) {
  try {
    const userResult = await pool.query(
      `SELECT id, phone_number, email, display_name, birth_date, gender, interested_in, 
              bio, location_latitude, location_longitude, is_verified, verified_at, tier_id,
              nationality, state, city, area, interests, profession, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    const mediaResult = await pool.query(
      'SELECT id, media_url, display_order FROM user_media WHERE user_id = $1 ORDER BY display_order ASC',
      [req.userId]
    );

    user.photos = mediaResult.rows;
    res.json(user);
  } catch (error) {
    console.error('Error fetching own profile:', error);
    res.status(500).json({ error: 'Server error fetching profile' });
  }
}

async function updateProfile(req, res) {
  const { name, bio, dob, gender, interested_in, nationality, state, city, area, interests, profession } = req.body;

  try {
    const result = await pool.query(
      `UPDATE users 
       SET display_name = COALESCE($1, display_name),
           bio = COALESCE($2, bio),
           birth_date = COALESCE($3, birth_date),
           gender = COALESCE($4, gender),
           interested_in = COALESCE($5, interested_in),
           nationality = COALESCE($6, nationality),
           state = COALESCE($7, state),
           city = COALESCE($8, city),
           area = COALESCE($9, area),
           interests = COALESCE($10, interests),
           profession = COALESCE($11, profession),
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $12
       RETURNING id, display_name, bio, birth_date, gender, interested_in, nationality, state, city, area, interests, profession`,
      [name, bio, dob, gender, interested_in, nationality, state, city, area, interests, profession, req.userId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'Profile updated successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Server error updating profile' });
  }
}

async function uploadPhoto(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No photo file provided' });
  }

  const fileBuffer = req.file.buffer;
  const mimeType = req.file.mimetype;
  const filename = req.file.originalname || 'upload.jpg';

  try {
    // 1. Upload to storage service
    const mediaUrl = await storageService.uploadPhoto(req.userId, fileBuffer, mimeType, filename);

    // 2. Count existing photos to assign display order
    const countResult = await pool.query('SELECT COUNT(*) FROM user_media WHERE user_id = $1', [req.userId]);
    const displayOrder = parseInt(countResult.rows[0].count, 10);

    // 3. Save to database
    const dbResult = await pool.query(
      `INSERT INTO user_media (user_id, media_url, display_order)
       VALUES ($1, $2, $3)
       RETURNING id, media_url, display_order`,
      [req.userId, mediaUrl, displayOrder]
    );

    res.status(201).json({ message: 'Photo uploaded successfully', photo: dbResult.rows[0] });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: 'Failed to upload photo.' });
  }
}

async function deletePhoto(req, res) {
  const { photoId } = req.params;

  try {
    // Verify photo belongs to user
    const photoResult = await pool.query('SELECT media_url FROM user_media WHERE id = $1 AND user_id = $2', [photoId, req.userId]);
    if (photoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Photo not found or unauthorized' });
    }

    const { media_url } = photoResult.rows[0];

    // 1. Delete from Storage
    await storageService.deletePhoto(media_url);

    // 2. Delete from DB
    await pool.query('DELETE FROM user_media WHERE id = $1', [photoId]);

    // 3. Re-adjust display_order for remaining photos
    const remainingPhotos = await pool.query('SELECT id FROM user_media WHERE user_id = $1 ORDER BY display_order ASC', [req.userId]);
    for (let i = 0; i < remainingPhotos.rows.length; i++) {
      await pool.query('UPDATE user_media SET display_order = $1 WHERE id = $2', [i, remainingPhotos.rows[i].id]);
    }

    res.json({ message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Photo deletion error:', error);
    res.status(500).json({ error: 'Failed to delete photo.' });
  }
}

async function reorderPhotos(req, res) {
  const { photoIds } = req.body;
  if (!Array.isArray(photoIds)) {
    return res.status(400).json({ error: 'photoIds must be an array of photo IDs' });
  }

  try {
    for (let i = 0; i < photoIds.length; i++) {
      await pool.query(
        'UPDATE user_media SET display_order = $1 WHERE id = $2 AND user_id = $3',
        [i, photoIds[i], req.userId]
      );
    }
    res.json({ message: 'Photos reordered successfully' });
  } catch (error) {
    console.error('Photo reordering error:', error);
    res.status(500).json({ error: 'Failed to reorder photos.' });
  }
}

async function deleteAccount(req, res) {
  try {
    // Get all user photos first to delete them from storage
    const photosResult = await pool.query('SELECT media_url FROM user_media WHERE user_id = $1', [req.userId]);
    for (const row of photosResult.rows) {
      await storageService.deletePhoto(row.media_url);
    }

    // Deleting the user will cascade delete all matches, swipes, messages, feelings, tokens, etc.
    await pool.query('DELETE FROM users WHERE id = $1', [req.userId]);

    res.json({ message: 'Account and all associated data deleted successfully.' });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Failed to delete account.' });
  }
}

async function updateBio(req, res) {
  const { bio } = req.body;
  try {
    const result = await pool.query(
      'UPDATE users SET bio = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, bio',
      [bio, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating bio:', error);
    res.status(500).json({ error: 'Server error updating bio' });
  }
}

module.exports = {
  getMyProfile,
  updateProfile,
  uploadPhoto,
  deletePhoto,
  reorderPhotos,
  deleteAccount,
  updateBio
};
