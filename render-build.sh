#!/usr/bin/env bash
set -e  # Exit on error

# Install dependencies
npm install --build-from-source sqlite3

# Create database directory if it doesn't exist
mkdir -p data

# Make sure the database file exists and is writable
touch bets.db
chmod 666 bets.db

# Initialize database
node init-db.js

# Verify database initialization
if [ ! -f bets.db ]; then
    echo "Error: Database file was not created"
    exit 1
fi

echo "Build completed successfully"
