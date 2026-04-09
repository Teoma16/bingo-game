-- ==========================================
-- BINGO GAME DATABASE SCHEMA FOR RAILWAY
-- ==========================================

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(100),
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    wallet_balance DECIMAL(10,2) DEFAULT 0.00,
    total_played INT DEFAULT 0,
    total_won INT DEFAULT 0,
    total_bonus DECIMAL(10,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cartelas Table (100 pre-generated bingo cards)
CREATE TABLE IF NOT EXISTS cartelas (
    id SERIAL PRIMARY KEY,
    lucky_number INT UNIQUE NOT NULL,
    card_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Games Table
CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    game_number INT NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting',
    total_players INT DEFAULT 0,
    total_cartelas INT DEFAULT 0,
    prize_pool DECIMAL(10,2) DEFAULT 0.00,
    commission DECIMAL(10,2) DEFAULT 0.00,
    winner_ids JSONB,
    winner_amount DECIMAL(10,2),
    called_numbers JSONB DEFAULT '[]',
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Game Players Table
CREATE TABLE IF NOT EXISTS game_players (
    id SERIAL PRIMARY KEY,
    game_id INT REFERENCES games(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    cartela_ids JSONB NOT NULL,
    is_winner BOOLEAN DEFAULT false,
    prize_amount DECIMAL(10,2) DEFAULT 0.00,
    marked_numbers JSONB DEFAULT '[]',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, user_id)
);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    reference VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Deposit Requests Table
CREATE TABLE IF NOT EXISTS deposit_requests (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    sms_text TEXT,
    telebirr_reference VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    approved_by INT,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Withdraw Requests Table
CREATE TABLE IF NOT EXISTS withdraw_requests (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    approved_by INT,
    approved_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin Users Table
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin Settings Table
CREATE TABLE IF NOT EXISTS admin_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(50) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Advertisements Table
CREATE TABLE IF NOT EXISTS advertisements (
    id SERIAL PRIMARY KEY,
    image_url VARCHAR(255),
    message TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_game_players_user_id ON game_players(user_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);
CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON deposit_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdraw_requests_status ON withdraw_requests(status);

-- Insert default admin (password: admin123)
-- Password hash is for "admin123" using bcrypt
INSERT INTO admin_users (username, email, phone_number, password_hash, full_name, role, is_active)
VALUES (
    'admin',
    'admin@bingo.com',
    '251911111111',
    '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mr/.cZQqFqFqFqFqFqFqFqFqFqFq',
    'System Administrator',
    'super_admin',
    true
) ON CONFLICT (username) DO NOTHING;

-- Insert default settings
INSERT INTO admin_settings (setting_key, setting_value, description) VALUES
    ('max_cartelas_per_player', '2', 'Maximum cartelas a player can select per game'),
    ('prepare_time', '35', 'Countdown time before game starts (seconds)'),
    ('call_interval', '4', 'Time between number calls (seconds)'),
    ('entry_fee', '10', 'Entry fee per cartela (Birr)'),
    ('winner_percentage', '81', 'Percentage of prize pool given to winners'),
    ('commission_percentage', '19', 'Percentage taken as commission'),
    ('fast_win_call_limit', '5', 'Number of calls for fast win bonus'),
    ('fast_win_bonus_percentage', '1000', 'Bonus percentage for fast win'),
    ('welcome_bonus', '10', 'Welcome bonus for new users (Birr)')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert sample test user (optional)
INSERT INTO users (telegram_id, username, phone_number, wallet_balance, is_active)
VALUES 
    (123456789, 'TestPlayer1', '251911111111', 100.00, true),
    (987654321, 'TestPlayer2', '251922222222', 50.00, true)
ON CONFLICT (telegram_id) DO NOTHING;

-- Insert welcome bonus transaction for test users
INSERT INTO transactions (user_id, type, amount, balance_after, status, description)
SELECT id, 'bonus', 100.00, 100.00, 'completed', 'Welcome bonus'
FROM users WHERE username = 'TestPlayer1'
ON CONFLICT DO NOTHING;

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Database schema created successfully!';
    RAISE NOTICE '📊 Tables created: users, cartelas, games, game_players, transactions';
    RAISE NOTICE '📊 deposit_requests, withdraw_requests, admin_users, admin_settings, advertisements';
    RAISE NOTICE '👤 Admin user created: username=admin, password=admin123';
END $$;