-- ============================================================
-- FILLINGS — COMPLETE DATABASE SETUP (consolidated, safe to re-run)
-- Paste this whole file into Supabase SQL Editor and click "Run"
-- Uses IF NOT EXISTS everywhere so it won't break if some tables
-- already exist from earlier sessions.
-- ============================================================

-- ---------- 1. Subscription tiers ----------
DO $$ BEGIN
  CREATE TYPE tier_name_enum AS ENUM ('free', 'no_ads', 'unlimited_swipe', 'all_features');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS user_tiers (
    id SERIAL PRIMARY KEY,
    name tier_name_enum NOT NULL UNIQUE,
    price_in_inr DECIMAL(6, 2) NOT NULL,
    has_ads BOOLEAN DEFAULT TRUE,
    daily_swipe_limit INT DEFAULT 50,
    daily_message_limit INT DEFAULT 1,
    can_share_contact_info BOOLEAN DEFAULT FALSE
);

INSERT INTO user_tiers (name, price_in_inr, has_ads, daily_swipe_limit, daily_message_limit, can_share_contact_info)
VALUES
  ('free', 0.00, TRUE, 50, 1, FALSE),
  ('no_ads', 99.00, FALSE, 50, 1, FALSE),
  ('unlimited_swipe', 299.00, TRUE, -1, 5, FALSE),
  ('all_features', 499.00, FALSE, -1, -1, TRUE)
ON CONFLICT (name) DO NOTHING;

-- ---------- 2. Users ----------
DO $$ BEGIN
  CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    birth_date DATE NOT NULL,
    gender gender_enum NOT NULL,
    interested_in gender_enum[] NOT NULL,
    bio TEXT,
    location_latitude NUMERIC(9, 6),
    location_longitude NUMERIC(9, 6),
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP WITH TIME ZONE,
    tier_id INT NOT NULL REFERENCES user_tiers(id) DEFAULT 1,
    swipes_used_today INT DEFAULT 0,
    messages_sent_today INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Verification / signup-flow fields (added in later sessions)
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_reference_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS nationality VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS area VARCHAR(100);
-- Interest-based matching + profession (added this session's earlier work)
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profession VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_users_location ON users(location_latitude, location_longitude);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier_id);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_face_id ON users(face_id);
CREATE INDEX IF NOT EXISTS idx_users_interests ON users USING GIN (interests);

-- ---------- 3. User media (photos) ----------
CREATE TABLE IF NOT EXISTS user_media (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_media_user ON user_media(user_id);

-- ---------- 4. Swipes ----------
DO $$ BEGIN
  CREATE TYPE swipe_type_enum AS ENUM ('dislike', 'like', 'superlike');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS swipes (
    id BIGSERIAL PRIMARY KEY,
    swiper_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    swipee_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    swipe_type swipe_type_enum NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (swiper_id, swipee_id)
);
CREATE INDEX IF NOT EXISTS idx_swipes_swiper ON swipes(swiper_id);

-- ---------- 5. Matches ----------
CREATE TABLE IF NOT EXISTS matches (
    id BIGSERIAL PRIMARY KEY,
    user_1_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_2_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_1_id, user_2_id),
    CONSTRAINT check_user_order CHECK (user_1_id < user_2_id)
);

-- ---------- 6. Messages ----------
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_messages_match ON messages(match_id);

-- ---------- 7. Feelings (Snapchat-style photo + caption sharing) ----------
CREATE TABLE IF NOT EXISTS feelings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    photo_url TEXT,
    feeling_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_feelings_created ON feelings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feelings_user ON feelings(user_id);

-- ============================================================
-- DONE. Expected tables: user_tiers, users, user_media, swipes,
-- matches, messages, feelings
-- ============================================================
