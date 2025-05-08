
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const db = new sqlite3.Database('./bets.db');

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

db.run(\`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT
)\`);
db.run(\`CREATE TABLE IF NOT EXISTS bets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  category TEXT,
  bet TEXT
)\`);

app.get('/', (req, res) => {
  res.render('register');
});

app.post('/register', (req, res) => {
  const name = req.body.name;
  db.run('INSERT INTO users (name) VALUES (?)', [name], function(err) {
    if (err) return res.send('Feil ved registrering');
    res.redirect(`/bet/${this.lastID}`);
  });
});

app.get('/bet/:userId', (req, res) => {
  const userId = req.params.userId;
  res.render('bet', { userId });
});

app.post('/bet/:userId', (req, res) => {
  const userId = req.params.userId;
  const { gender, weight, birthdate, hair, team, firstword } = req.body;

  db.run('INSERT INTO bets (user_id, category, bet) VALUES (?, ?, ?)', [userId, 'gender', gender]);
  db.run('INSERT INTO bets (user_id, category, bet) VALUES (?, ?, ?)', [userId, 'weight', weight]);
  db.run('INSERT INTO bets (user_id, category, bet) VALUES (?, ?, ?)', [userId, 'birthdate', birthdate]);
  db.run('INSERT INTO bets (user_id, category, bet) VALUES (?, ?, ?)', [userId, 'hair', hair]);
  db.run('INSERT INTO bets (user_id, category, bet) VALUES (?, ?, ?)', [userId, 'team', team]);
  db.run('INSERT INTO bets (user_id, category, bet) VALUES (?, ?, ?)', [userId, 'firstword', firstword]);

  res.send('Bet lagret! Du kan lukke siden.');
});

app.get('/admin', (req, res) => {
  db.all(\`SELECT users.name, bets.category, bets.bet FROM bets
          JOIN users ON users.id = bets.user_id\`, (err, rows) => {
    if (err) return res.send('Feil ved henting av data');
    res.render('admin', { rows });
  });
});

app.listen(3000, () => {
  console.log('Server kjører på http://localhost:3000');
});
