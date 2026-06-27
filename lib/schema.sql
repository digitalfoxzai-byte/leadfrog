-- LeadFrog Database Schema
CREATE DATABASE IF NOT EXISTS leadfrog_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE leadfrog_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('user','admin') DEFAULT 'user',
  plan ENUM('free','starter','pro','business') DEFAULT 'free',
  plan_expires_at DATETIME NULL,
  scrape_count INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(150),
  address TEXT,
  website VARCHAR(300),
  category VARCHAR(100),
  rating DECIMAL(2,1) DEFAULT 0,
  reviews INT DEFAULT 0,
  status ENUM('new','contacted','qualified','converted','lost') DEFAULT 'new',
  source VARCHAR(50) DEFAULT 'google_maps',
  keyword VARCHAR(100),
  location VARCHAR(100),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plan ENUM('starter','pro','business') NOT NULL,
  razorpay_order_id VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  amount INT NOT NULL,
  status ENUM('pending','active','failed','cancelled') DEFAULT 'pending',
  starts_at DATETIME,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(100) UNIQUE NOT NULL,
  `value` TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Default settings
INSERT IGNORE INTO settings (`key`, `value`) VALUES
  ('razorpay_key_id', ''),
  ('razorpay_key_secret', ''),
  ('razorpay_mode', 'test'),
  ('starter_price', '499'),
  ('pro_price', '999'),
  ('business_price', '2499'),
  ('starter_leads', '500'),
  ('pro_leads', '2000'),
  ('business_leads', '10000'),
  ('smtp_host', ''),
  ('smtp_port', '465'),
  ('smtp_secure', '1'),
  ('smtp_user', ''),
  ('smtp_pass', ''),
  ('smtp_from_name', 'LeadFrog'),
  ('smtp_from_email', '');
