-- LAMPARA Database Schema
-- STI College BSIT Capstone 2026
-- Updated to match production Railway database

-- Create database
CREATE DATABASE IF NOT EXISTS lampara_database;
USE lampara_database;

-- Admin/Staff users table
CREATE TABLE IF NOT EXISTS Admin_User (
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

-- Players table (Unity game players)
CREATE TABLE IF NOT EXISTS players (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  level INT DEFAULT 1,
  experience INT DEFAULT 0,
  status ENUM('active', 'inactive', 'banned') DEFAULT 'inactive',
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_online TINYINT(1) DEFAULT 0,
  suspicion INT DEFAULT 0,
  chapter INT DEFAULT 1,
  verify_token VARCHAR(128) NULL,
  token_expires_at DATETIME NULL,
  INDEX idx_username (username),
  INDEX idx_email (email),
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
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_timestamp (timestamp)
);

-- Legacy users table (kept for backward compatibility, use Admin_User instead)
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('admin', 'staff', 'user') DEFAULT 'user',
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Show version info
SELECT 'LAMPARA Database Schema v2.0 - Matches Production!' as status;
