-- ============================================================
-- MILAN DATING APP — FULL DATABASE SETUP
-- Paste this whole file into Supabase SQL Editor and click "Run"
-- ============================================================

-- ---------- 1. Subscription tiers ----------
CREATE TYPE tier_name_enum AS ENUM ('free', 'no_ads', 'unlimited_swipe', 'all_features');

CREATE TABLE user_tiers (
    id SERIAL PRIMARY KEY,
    name tier_name_enum NOT NULL UNIQUE,
    price_in_inr DECIMAL(6, 2) NOT NULL,
    has_ads BOOLEAN DEFAULT TRUE,
    daily_swipe_limit INT DEFAULT 50,
    daily_message_limit INT DEFAULT 1,
    can_share_contact_info BOOLEAN DEFAULT FALSE
);

INSERT INTO user_tiers (name, price_in_inr, has_ads, daily_swipe_limit, daily_message_limit, can_share_contact_info) VALUES
('free', 0.00, TRUE, 50, 1, FALSE),
('no_ads', 99.00, FALSE, 50, 1, FALSE),
('unlimited_swipe', 299.00, TRUE, -1, 5, FALSE),
('all_features', 499.00, FALSE, -1, -1, TRUE);

-- ---------- 2. Users ----------
CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other');

CREATE TABLE users (
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- verification / signup-flow fields
    google_id VARCHAR(255) UNIQUE,
    face_id VARCHAR(255) UNIQUE,
    kyc_status VARCHAR(20) DEFAULT 'pending',
    kyc_reference_id VARCHAR(255),
    nationality VARCHAR(100),
    state VARCHAR(100),
    city VARCHAR(100),
    area VARCHAR(100)
);

CREATE INDEX idx_users_location ON users(location_latitude, location_longitude);
CREATE INDEX idx_users_tier ON users(tier_id);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_face_id ON users(face_id);

-- ---------- 3. User media (photos) ----------
CREATE TABLE user_media (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_media_user ON user_media(user_id);

-- ---------- 4. Swipes ----------
CREATE TYPE swipe_type_enum AS ENUM ('dislike', 'like', 'superlike');

CREATE TABLE swipes (
    id BIGSERIAL PRIMARY KEY,
    swiper_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    swipee_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    swipe_type swipe_type_enum NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (swiper_id, swipee_id)
);

CREATE INDEX idx_swipes_swiper ON swipes(swiper_id);

-- ---------- 5. Matches ----------
CREATE TABLE matches (
    id BIGSERIAL PRIMARY KEY,
    user_1_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_2_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_1_id, user_2_id),
    CONSTRAINT check_user_order CHECK (user_1_id < user_2_id)
);

-- ---------- 6. Messages ----------
CREATE TABLE messages (
    id BIGSERIAL PRIMARY KEY,
    match_id BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_match ON messages(match_id);

-- ============================================================
-- DONE. You should now see 5 tables in Supabase's Table Editor:
-- user_tiers, users, user_media, swipes, matches, messages
-- ============================================================
