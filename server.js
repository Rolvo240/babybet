const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const db = new sqlite3.Database('./bets.db');

const deadline = new Date("2025-06-30T23:59:59");
const adminPassword = "truls123";

db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS bets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  category TEXT,
  bet TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS scores (
  user_id INTEGER,
  reaction INTEGER,
  flappy INTEGER
)`);

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.render('register');
});

app.post('/register', (req, res) => {
  const name = req.body.name;
  db.run('INSERT INTO users (name) VALUES (?)', [name], function (err) {
    if (err) return res.send('Feil ved registrering');
    res.redirect(`/bet/${this.lastID}`);
  });
});

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
  if (now > deadline) {
    return res.send("Tipping er stengt. Du er for sein, kompis!");
  }

  const userId = req.params.userId;
  const { weight, birthdate, hair } = req.body;

  db.run('INSERT INTO bets (user_id, category, bet) VALUES (?, ?, ?)', [userId, 'weight', weight]);
  db.run('INSERT INTO bets (user_id, category, bet) VALUES (?, ?, ?)', [userId, 'birthdate', birthdate]);
  db.run('INSERT INTO bets (user_id, category, bet) VALUES (?, ?, ?)', [userId, 'hair', hair]);
  db.run('INSERT INTO bets (user_id, category, bet) VALUES (?, ?, ?)', [userId, 'truls_keeg', 'Ja']);

  res.redirect(`/reaction`);
});

app.get('/reaction', (req, res) => {
  res.render('reaction');
});

app.get('/flappy', (req, res) => {
  res.render('flappy');
});

app.get('/admin', (req, res) => {
  const pass = req.query.pass;
  if (pass !== adminPassword) {
    return res.send("⛔ Du har ikke tilgang, kompis.");
  }

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

app.get('/leaderboard', (req, res) => {
  db.all('SELECT users.name, scores.reaction, scores.flappy FROM users JOIN scores ON users.id = scores.user_id', (err, rows) => {
    if (err) return res.send('Feil ved henting av leaderboard');
    const ranked = rows.map(r => ({ ...r, total: r.reaction + r.flappy }))
                       .sort((a, b) => b.total - a.total);
    res.render('leaderboard', { scores: ranked });
  });
});

app.get('/reset/:userId', (req, res) => {
  const userId = req.params.userId;
  db.run('DELETE FROM bets WHERE user_id = ?', userId);
  db.run('DELETE FROM scores WHERE user_id = ?', userId);
  res.send('Dine bets og score er slettet.');
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log("✅ BabyBet kjører på port " + PORT);
});
