require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// Database initialization function
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database('./bets.db', (err) => {
            if (err) {
                console.error('Error connecting to database:', err);
                reject(err);
                return;
            }
            console.log('Connected to database successfully');

            db.serialize(() => {
                // Users table
                db.run(`CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT,
                    saldo INTEGER DEFAULT 1000,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                // Bets table
                db.run(`CREATE TABLE IF NOT EXISTS bets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    category TEXT,
                    bet TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                // Scores table
                db.run(`CREATE TABLE IF NOT EXISTS scores (
                    user_id INTEGER,
                    reaction INTEGER,
                    flappy INTEGER,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                // Achievements table
                db.run(`CREATE TABLE IF NOT EXISTS achievements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT,
                    description TEXT,
                    icon TEXT,
                    requirement INTEGER
                )`);

                // User achievements table
                db.run(`CREATE TABLE IF NOT EXISTS user_achievements (
                    user_id INTEGER,
                    achievement_id INTEGER,
                    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, achievement_id)
                )`);

                // Statistics table
                db.run(`CREATE TABLE IF NOT EXISTS statistics (
                    user_id INTEGER PRIMARY KEY,
                    games_played INTEGER DEFAULT 0,
                    games_won INTEGER DEFAULT 0,
                    total_winnings INTEGER DEFAULT 0,
                    biggest_win INTEGER DEFAULT 0,
                    last_played DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                // Insert default achievements
                const defaultAchievements = [
                    { name: 'Første Seier', description: 'Vinn ditt første spill', icon: '🏆', requirement: 1 },
                    { name: 'Høy Ruller', description: 'Vinn 1000 poeng', icon: '💰', requirement: 1000 },
                    { name: 'Casino Kong', description: 'Vinn 10 spill', icon: '👑', requirement: 10 },
                    { name: 'Flappy Master', description: 'Få 100 poeng i Flappy Baby', icon: '🍼', requirement: 100 },
                    { name: 'Reaction Pro', description: 'Få 50 poeng i Reaction Game', icon: '⚡', requirement: 50 }
                ];

                let completed = 0;
                defaultAchievements.forEach(achievement => {
                    db.run('INSERT OR IGNORE INTO achievements (name, description, icon, requirement) VALUES (?, ?, ?, ?)',
                        [achievement.name, achievement.description, achievement.icon, achievement.requirement],
                        (err) => {
                            if (err) {
                                console.error('Error inserting achievement:', err);
                            }
                            completed++;
                            if (completed === defaultAchievements.length) {
                                resolve();
                            }
                        });
                });
            });
        });
    });
}

// Set database timeout
db.configure('busyTimeout', 5000);

const deadline = new Date("2025-06-30T23:59:59");
const adminPassword = process.env.ADMIN_PASSWORD;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdn.tailwindcss.com", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
            fontSrc: ["'self'", "fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "assets.mixkit.co"],
            connectSrc: ["'self'"],
            mediaSrc: ["'self'", "assets.mixkit.co"],
        },
    },
}));
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Noe gikk galt!');
});

// Database error handling
db.on('error', (err) => {
    console.error('Database error:', err);
});

app.set('view engine', 'ejs');

// Registrering
app.get('/', (req, res) => {
  res.render('register');
});

app.post('/register', (req, res) => {
  const name = req.body.name;
  db.run('INSERT INTO users (name, saldo) VALUES (?, ?)', [name, 1000], function(err) {
    if (err) return res.send("Feil ved registrering");
    res.redirect(`/start/${this.lastID}`);
  });
});

// Startvalg
app.get('/start/:userId', (req, res) => {
  res.render('start', { userId: req.params.userId });
});

// Betting
app.get('/bet/:userId', (req, res) => {
  const userId = req.params.userId;
  const now = new Date();
  const expired = now > deadline;

  db.all(`SELECT category, bet FROM bets`, (err, rows) => {
    if (err) return res.send('Feil ved henting av data');

    const weightBets = rows.filter(r => r.category === 'weight').map(r => r.bet);
    const dateBets = rows.filter(r => r.category === 'birthdate').map(r => r.bet);

    const calcOdds = (arr) => {
      const counts = {};
      arr.forEach(val => counts[val] = (counts[val] || 0) + 1);
      const total = arr.length;
      return Object.entries(counts).map(([value, count]) => {
        const raw = 1 / (count / total);
        return { value, odds: raw.toFixed(2) };
      }).sort((a, b) => b.odds - a.odds).slice(0, 5);
    };

    const weightOdds = calcOdds(weightBets);
    const dateOdds = calcOdds(dateBets);

    res.render('bet', { userId, expired, weightOdds, dateOdds });
  });
});

app.post('/bet/:userId', (req, res) => {
  const now = new Date();
  if (now > deadline) return res.send("Tipping er stengt. Du er for sein, kompis!");

  const userId = req.params.userId;
  const { weight, birthdate, hair } = req.body;

  db.run('INSERT INTO bets (user_id, category, bet) VALUES (?, ?, ?)', [userId, 'weight', weight]);
  db.run('INSERT INTO bets (user_id, category, bet) VALUES (?, ?, ?)', [userId, 'birthdate', birthdate]);
  db.run('INSERT INTO bets (user_id, category, bet) VALUES (?, ?, ?)', [userId, 'hair', hair]);
  db.run('INSERT INTO bets (user_id, category, bet) VALUES (?, ?, ?)', [userId, 'truls_keeg', 'Ja']);

  res.redirect(`/casino/${userId}`);
});

// Casino
app.get('/casino/:userId', (req, res) => {
  const userId = req.params.userId;
  db.get('SELECT saldo FROM users WHERE id = ?', [userId], (err, row) => {
    if (err || !row) return res.send("Fant ikke saldo.");
    res.render('casino', { userId, saldo: row.saldo });
  });
});

app.get('/casino/reaction/:userId', (req, res) => {
  res.render('reaction', { userId: req.params.userId });
});

app.get('/casino/flappy/:userId', (req, res) => {
  res.render('flappy', { userId: req.params.userId });
});

// Coinflip
app.get('/coinflip/:userId', (req, res) => {
  const userId = req.params.userId;
  db.get('SELECT saldo FROM users WHERE id = ?', [userId], (err, row) => {
    if (err || !row) return res.send("Fant ikke saldo.");
    res.render('coinflip', { userId, saldo: row.saldo, message: null });
  });
});

app.post('/coinflip/:userId', (req, res) => {
  const userId = req.body.userId;
  const guess = req.body.guess;
  const result = Math.random() < 0.5 ? 'keeg' : 'ikke';
  const win = guess === result;

  db.get('SELECT saldo FROM users WHERE id = ?', [userId], (err, row) => {
    if (!row || row.saldo < 50) return res.send("Du er blakk 💀");

    const newSaldo = row.saldo - 50 + (win ? 120 : 0);
    const msg = win ? `🤑 Du traff ${result.toUpperCase()} og vant 120!` : `👎 Det ble ${result.toUpperCase()}. Du tapte.`;

    db.run('UPDATE users SET saldo = ? WHERE id = ?', [newSaldo, userId], () => {
      if (win) {
        updateStatistics(userId, 120);
        checkAchievements(userId);
      }
      res.render('coinflip', { userId, saldo: newSaldo, message: msg });
    });
  });
});

// Rulett
app.get('/roulette/:userId', (req, res) => {
  const userId = req.params.userId;
  db.get('SELECT saldo FROM users WHERE id = ?', [userId], (err, row) => {
    if (err || !row) return res.send("Fant ikke saldo.");
    res.render('roulette', { userId, saldo: row.saldo, message: null });
  });
});

app.post('/roulette/:userId', (req, res) => {
  const userId = req.body.userId;
  const color = req.body.color;
  const outcome = Math.random() < 0.5 ? 'red' : 'green';
  const win = color === outcome;

  db.get('SELECT saldo FROM users WHERE id = ?', [userId], (err, row) => {
    if (!row || row.saldo < 50) return res.send("Du er blakk 💀");

    const newSaldo = row.saldo - 50 + (win ? 100 : 0);
    const msg = win ? `🎉 Du traff ${outcome.toUpperCase()} og vant 100!` : `😢 Det ble ${outcome.toUpperCase()}. Du tapte.`;

    db.run('UPDATE users SET saldo = ? WHERE id = ?', [newSaldo, userId], () => {
      res.render('roulette', { userId, saldo: newSaldo, message: msg });
    });
  });
});

// Admin
app.get('/admin', (req, res) => {
  const pass = req.query.pass;
  if (pass !== adminPassword) return res.send("⛔ Du har ikke tilgang, kompis.");

  db.all('SELECT users.id, users.name, bets.category, bets.bet FROM users JOIN bets ON users.id = bets.user_id', (err, betRows) => {
    if (err) return res.send('Feil ved henting av bets');

    db.all('SELECT * FROM scores', (err2, scoreRows) => {
      if (err2) return res.send('Feil ved henting av score');

      const grouped = {};
      betRows.forEach(row => {
        if (!grouped[row.id]) grouped[row.id] = { name: row.name, bets: [] };
        grouped[row.id].bets.push({ category: row.category, bet: row.bet });
      });

      scoreRows.forEach(score => {
        if (grouped[score.user_id]) {
          grouped[score.user_id].reaction = score.reaction;
          grouped[score.user_id].flappy = score.flappy;
          grouped[score.user_id].total = score.reaction + score.flappy;
        }
      });

      res.render('admin', { data: Object.values(grouped) });
    });
  });
});

// Leaderboard
app.get('/leaderboard', (req, res) => {
  db.all('SELECT users.name, scores.reaction, scores.flappy FROM users JOIN scores ON users.id = scores.user_id', (err, rows) => {
    if (err) return res.send('Feil ved henting av leaderboard');
    const ranked = rows.map(r => ({ ...r, total: r.reaction + r.flappy }))
                       .sort((a, b) => b.total - a.total);
    res.render('leaderboard', { scores: ranked });
  });
});

// Reset
app.get('/reset/:userId', (req, res) => {
  const userId = req.params.userId;
  db.run('DELETE FROM bets WHERE user_id = ?', userId);
  db.run('DELETE FROM scores WHERE user_id = ?', userId);
  res.send('Dine bets og score er slettet.');
});

// Oppdater statistikk når en bruker vinner
function updateStatistics(userId, amount) {
  db.run(`INSERT INTO statistics (user_id, games_played, games_won, total_winnings, biggest_win)
          VALUES (?, 1, 1, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
          games_played = games_played + 1,
          games_won = games_won + 1,
          total_winnings = total_winnings + ?,
          biggest_win = CASE WHEN ? > biggest_win THEN ? ELSE biggest_win END,
          last_played = CURRENT_TIMESTAMP`,
    [userId, amount, amount, amount, amount, amount]);
}

// Oppdater statistikk når en bruker taper
function updateLossStatistics(userId) {
  db.run(`INSERT INTO statistics (user_id, games_played)
          VALUES (?, 1)
          ON CONFLICT(user_id) DO UPDATE SET
          games_played = games_played + 1,
          last_played = CURRENT_TIMESTAMP`,
    [userId]);
}

// Sjekk achievements
function checkAchievements(userId) {
  db.get('SELECT * FROM statistics WHERE user_id = ?', [userId], (err, stats) => {
    if (err || !stats) return;

    db.all('SELECT * FROM achievements', (err, achievements) => {
      if (err) return;

      achievements.forEach(achievement => {
        if (stats.games_won >= achievement.requirement) {
          db.run('INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
            [userId, achievement.id]);
        }
      });
    });
  });
}

// Profile
app.get('/profile/:userId', (req, res) => {
  const userId = req.params.userId;
  
  // Get user's saldo
  db.get('SELECT saldo FROM users WHERE id = ?', [userId], (err, user) => {
    if (err || !user) return res.send("Fant ikke bruker.");

    // Get user's statistics
    db.get('SELECT * FROM statistics WHERE user_id = ?', [userId], (err, stats) => {
      if (err) return res.send("Feil ved henting av statistikk.");
      
      // Initialize stats if none exist
      if (!stats) {
        stats = {
          games_played: 0,
          games_won: 0,
          total_winnings: 0,
          biggest_win: 0
        };
      }

      // Get all achievements and mark which ones the user has earned
      db.all('SELECT a.*, CASE WHEN ua.user_id IS NOT NULL THEN 1 ELSE 0 END as earned FROM achievements a LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?', [userId], (err, achievements) => {
        if (err) return res.send("Feil ved henting av achievements.");
        
        res.render('profile', { 
          userId, 
          saldo: user.saldo,
          stats,
          achievements
        });
      });
    });
  });
});

// Start server
const port = process.env.PORT || 10000;
app.listen(port, () => {
    console.log(`✅ BabyBet kjører på port ${port}`);
    console.log('Environment:', process.env.NODE_ENV);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        }
        process.exit(0);
    });
});
