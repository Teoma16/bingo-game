-- Create Database
CREATE DATABASE bingo_db;

-- Users Table
CREATE TABLE users (
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
CREATE TABLE cartelas (
    id SERIAL PRIMARY KEY,
    lucky_number INT UNIQUE NOT NULL, -- 1 to 100
    card_data JSONB NOT NULL, -- 5x5 grid with numbers
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Games Table
CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    game_number INT NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting', -- waiting, active, completed
    total_players INT DEFAULT 0,
    total_cartelas INT DEFAULT 0,
    prize_pool DECIMAL(10,2) DEFAULT 0.00,
    commission DECIMAL(10,2) DEFAULT 0.00,
    winner_ids JSONB, -- Array of winner user IDs
    winner_amount DECIMAL(10,2),
    called_numbers JSONB DEFAULT '[]',
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Game Players (User participation in a game)
CREATE TABLE game_players (
    id SERIAL PRIMARY KEY,
    game_id INT REFERENCES games(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    cartela_ids JSONB NOT NULL, -- Array of lucky numbers selected
    is_winner BOOLEAN DEFAULT false,
    prize_amount DECIMAL(10,2) DEFAULT 0.00,
    marked_numbers JSONB DEFAULT '[]',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, user_id)
);

-- Transactions Table (Wallet)
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20), -- deposit, withdraw, game_fee, prize, bonus
    amount DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
    reference VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Deposit Requests
CREATE TABLE deposit_requests (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    sms_text TEXT,
    telebirr_reference VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    approved_by INT,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Withdraw Requests
CREATE TABLE withdraw_requests (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    phone_number VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, completed
    approved_by INT,
    approved_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bonus Tracking
CREATE TABLE bonuses (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    bonus_type VARCHAR(30), -- daily_play, fast_win, welcome
    amount DECIMAL(10,2) NOT NULL,
    game_id INT,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily Play Bonus Progress
CREATE TABLE daily_play_progress (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    games_played INT DEFAULT 0,
    window_start TIMESTAMP,
    window_end TIMESTAMP,
    bonus_claimed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, window_start)
);

-- Admin Settings
CREATE TABLE admin_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(50) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Advertisements
CREATE TABLE advertisements (
    id SERIAL PRIMARY KEY,
    image_url VARCHAR(255),
    message TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Game Statistics
CREATE TABLE game_statistics (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    total_games INT DEFAULT 0,
    total_players INT DEFAULT 0,
    total_deposits DECIMAL(10,2) DEFAULT 0.00,
    total_withdrawals DECIMAL(10,2) DEFAULT 0.00,
    total_commission DECIMAL(10,2) DEFAULT 0.00,
    total_prize_paid DECIMAL(10,2) DEFAULT 0.00,
    new_users INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_game_players_game_id ON game_players(game_id);
CREATE INDEX idx_game_players_user_id ON game_players(user_id);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_created_at ON games(created_at);
CREATE INDEX idx_deposit_requests_status ON deposit_requests(status);
CREATE INDEX idx_withdraw_requests_status ON withdraw_requests(status);