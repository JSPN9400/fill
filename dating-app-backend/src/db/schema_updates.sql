-- Run this AFTER the original schema (user_tiers, users, swipes, matches, messages)
-- Adds fields needed for the signup / verification flow

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
    ADD COLUMN IF NOT EXISTS face_id VARCHAR(255) UNIQUE,        -- Rekognition FaceId (dedupe key)
    ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) DEFAULT 'pending', -- pending | verified | rejected
    ADD COLUMN IF NOT EXISTS kyc_reference_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS nationality VARCHAR(100),
    ADD COLUMN IF NOT EXISTS state VARCHAR(100),
    ADD COLUMN IF NOT EXISTS city VARCHAR(100),
    ADD COLUMN IF NOT EXISTS area VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_face_id ON users(face_id);
