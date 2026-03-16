-- LAMPARA Database Schema
-- STI College BSIT Capstone 2026

-- Create database
CREATE DATABASE IF NOT EXISTS lampara_database;
USE lampara_database;

-- Users table (for admin/staff)
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('admin', 'staff', 'user') DEFAULT 'user',
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  level INT DEFAULT 1,
  experience INT DEFAULT 0,
  status ENUM('active', 'inactive', 'banned') DEFAULT 'active',
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_level (level),
  INDEX idx_status (status)
);

-- Quests/Chapters table
CREATE TABLE IF NOT EXISTS quests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  chapter INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('active', 'inactive', 'archived') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_chapter_title (chapter, title),
  INDEX idx_chapter (chapter),
  INDEX idx_status (status)
);

-- Player Quest Progress table
CREATE TABLE IF NOT EXISTS player_quests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  player_id INT NOT NULL,
  quest_id INT NOT NULL,
  status ENUM('not_started', 'in_progress', 'completed', 'failed') DEFAULT 'not_started',
  progress_percent INT DEFAULT 0,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_player_quest (player_id, quest_id),
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  FOREIGN KEY (quest_id) REFERENCES quests(id) ON DELETE CASCADE,
  INDEX idx_player_id (player_id),
  INDEX idx_quest_id (quest_id),
  INDEX idx_status (status)
);

-- Activity Logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_timestamp (timestamp)
);

-- Insert demo admin user (password: SuperAdmin2026!)
INSERT INTO users (email, password, name, role, status) VALUES 
('admin@lampara.edu.ph', '$2a$10$Y3M4RqNV4KXsF.8vZ5tK.e82q4LKmx5KQYHEq9Zvq8yOmCYzVsAZO', 'Admin User', 'admin', 'active');

-- Insert demo players
INSERT INTO players (name, email, level, experience, status) VALUES 
('Demo Player 1', 'player1@lampara.edu.ph', 5, 1500, 'active'),
('Demo Player 2', 'player2@lampara.edu.ph', 3, 800, 'active'),
('Demo Player 3', 'player3@lampara.edu.ph', 7, 2300, 'active');

-- Insert demo quests
INSERT INTO quests (chapter, title, description, status) VALUES 
(1, 'Chapter 1 Quest 1', 'Complete the first quest', 'active'),
(1, 'Chapter 1 Quest 2', 'Defeat the boss', 'active'),
(2, 'Chapter 2 Quest 1', 'Find the hidden treasure', 'active'),
(2, 'Chapter 2 Quest 2', 'Rescue the NPC', 'active'),
(3, 'Chapter 3 Quest 1', 'Final challenge', 'active');

-- Insert demo player progress
INSERT INTO player_quests (player_id, quest_id, status, progress_percent) VALUES 
(1, 1, 'completed', 100),
(1, 2, 'in_progress', 50),
(2, 1, 'completed', 100),
(2, 2, 'not_started', 0),
(3, 1, 'completed', 100),
(3, 2, 'completed', 100),
(3, 3, 'in_progress', 75);

-- Create some sample logs
INSERT INTO activity_logs (user_id, action, description) VALUES 
(1, 'login', 'Admin logged in'),
(1, 'player_created', 'Created new player: Demo Player 1'),
(1, 'player_created', 'Created new player: Demo Player 2'),
(1, 'player_created', 'Created new player: Demo Player 3'),
(1, 'quest_created', 'Created Chapter 1 quests');

-- Show version info
SELECT 'LAMPARA Database Schema v1.0 - Ready!' as status;
