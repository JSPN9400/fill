-- Run this in Supabase SQL Editor (after your existing tables already exist)

CREATE TABLE feelings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    photo_url TEXT,                    -- base64 data URL for now (MVP) — swap for Cloudinary URL later
    feeling_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

CREATE INDEX idx_feelings_created ON feelings(created_at DESC);
CREATE INDEX idx_feelings_user ON feelings(user_id);
