const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

/**
 * Uploads a photo buffer to Supabase storage.
 * In mock mode or if Supabase keys are missing, returns a standard placeholder.
 */
async function uploadPhoto(userId, fileBuffer, mimeType, filename) {
  if (process.env.MOCK_MODE === 'true' || !supabase) {
    console.log('MOCK_MODE or Supabase not configured. Mocking photo upload.');
    // Return a random high-quality Unsplash avatar placeholder for realistic UI
    const mockAvatars = [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=80'
    ];
    const randomIndex = Math.floor(Math.random() * mockAvatars.length);
    return mockAvatars[randomIndex];
  }

  const bucketName = 'profile-photos';
  const path = `${userId}/${Date.now()}_${filename}`;

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(path, fileBuffer, {
      contentType: mimeType,
      upsert: true
    });

  if (error) {
    console.error('Supabase upload error:', error);
    throw new Error('Failed to upload image to storage.');
  }

  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(path);

  return publicUrlData.publicUrl;
}

/**
 * Deletes a file from Supabase storage based on its public URL.
 */
async function deletePhoto(photoUrl) {
  if (process.env.MOCK_MODE === 'true' || !supabase) {
    return true;
  }

  try {
    const bucketName = 'profile-photos';
    const parts = photoUrl.split(`/public/${bucketName}/`);
    if (parts.length < 2) return false;
    const path = parts[1];

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([path]);

    if (error) {
      console.error('Error deleting file from Supabase storage:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error parsing photo URL for deletion:', err);
    return false;
  }
}

module.exports = {
  uploadPhoto,
  deletePhoto
};
