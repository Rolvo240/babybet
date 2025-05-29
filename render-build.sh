#!/usr/bin/env bash
set -e  # Exit on error

# Install dependencies
npm install --build-from-source sqlite3
node init-db.js

# Create database directory if it doesn't exist
mkdir -p data

# Make sure the database file exists and is writable
touch bets.db
chmod 666 bets.db

echo "Build completed successfully"
