-- Run in Supabase SQL Editor

ALTER TABLE users ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_users_interests ON users USING GIN (interests);

-- Profession field (idea adopted from the Aura prototype's profile model)
ALTER TABLE users ADD COLUMN IF NOT EXISTS profession VARCHAR(150);
