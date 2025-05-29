#!/usr/bin/env bash
set -e  # Exit on error

# Install dependencies
npm install --build-from-source sqlite3

# Create database directory if it doesn't exist
mkdir -p data

# Make sure the database file exists and is writable
touch bets.db
chmod 666 bets.db

# Initialize database tables directly in the build script
node -e "
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./bets.db');

db.serialize(() => {
    // Users table
    db.run(\`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        saldo INTEGER DEFAULT 1000,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )\`);

    // Bets table
    db.run(\`CREATE TABLE IF NOT EXISTS bets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        category TEXT,
        bet TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )\`);

    // Scores table
    db.run(\`CREATE TABLE IF NOT EXISTS scores (
        user_id INTEGER,
        reaction INTEGER,
        flappy INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )\`);

    // Achievements table
    db.run(\`CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        description TEXT,
        icon TEXT,
        requirement INTEGER
    )\`);

    // User achievements table
    db.run(\`CREATE TABLE IF NOT EXISTS user_achievements (
        user_id INTEGER,
        achievement_id INTEGER,
        earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, achievement_id)
    )\`);

    // Statistics table
    db.run(\`CREATE TABLE IF NOT EXISTS statistics (
        user_id INTEGER PRIMARY KEY,
        games_played INTEGER DEFAULT 0,
        games_won INTEGER DEFAULT 0,
        total_winnings INTEGER DEFAULT 0,
        biggest_win INTEGER DEFAULT 0,
        last_played DATETIME DEFAULT CURRENT_TIMESTAMP
    )\`);

    // Insert default achievements
    const defaultAchievements = [
        { name: 'Første Seier', description: 'Vinn ditt første spill', icon: '🏆', requirement: 1 },
        { name: 'Høy Ruller', description: 'Vinn 1000 poeng', icon: '💰', requirement: 1000 },
        { name: 'Casino Kong', description: 'Vinn 10 spill', icon: '👑', requirement: 10 },
        { name: 'Flappy Master', description: 'Få 100 poeng i Flappy Baby', icon: '🍼', requirement: 100 },
        { name: 'Reaction Pro', description: 'Få 50 poeng i Reaction Game', icon: '⚡', requirement: 50 }
    ];

    defaultAchievements.forEach(achievement => {
        db.run('INSERT OR IGNORE INTO achievements (name, description, icon, requirement) VALUES (?, ?, ?, ?)',
            [achievement.name, achievement.description, achievement.icon, achievement.requirement]);
    });
});

db.close();
"

echo "Build completed successfully"
