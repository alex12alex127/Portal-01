const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { validateRegister, validateLogin } = require('../middleware/validation');
const { loginLimiter, registerLimiter, checkLoginAttempts, recordLoginAttempt, logLoginAttempt } = require('../middleware/security');

router.get('/login', (req, res) => {
  const base = req.app.get('basePath') || '';
  if (req.session && req.session.userId) return res.redirect(base + '/dashboard');
  res.render('auth/login', { layout: 'layouts/auth', title: 'Login - Portal-01' });
});

router.post('/login', loginLimiter, checkLoginAttempts, validateLogin, async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip || '';
  const key = req._loginKey;

  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      logLoginAttempt(username, false, ip);
      recordLoginAttempt(key, false);
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    const user = result.rows[0];
    if (user.is_active === false) {
      return res.status(403).json({ error: 'Account disabilitato. Contatta l\'amministratore.' });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      logLoginAttempt(username, false, ip);
      recordLoginAttempt(key, false);
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    logLoginAttempt(username, true, ip);
    recordLoginAttempt(key, true);
    await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    req.session.userId = user.id;
    req.session.user = { id: user.id, username: user.username, role: user.role, full_name: user.full_name, email: user.email };
    res.json({ success: true, redirect: (req.app.get('basePath') || '') + '/dashboard' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

router.get('/register', (req, res) => {
  const base = req.app.get('basePath') || '';
  if (req.session && req.session.userId) return res.redirect(base + '/dashboard');
  res.render('auth/register', { layout: 'layouts/auth', title: 'Registrazione - Portal-01' });
});

router.post('/register', registerLimiter, validateRegister, async (req, res) => {
  const { username, email, password, full_name } = req.body;
  try {
    const existing = await db.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existing.rows.length > 0) {
      if (existing.rows[0].username === username) return res.status(400).json({ error: 'Username già in uso' });
      return res.status(400).json({ error: 'Email già in uso' });
    }
    const hash = await bcrypt.hash(password, 12);
    await db.query('INSERT INTO users (username, email, password, full_name) VALUES ($1, $2, $3, $4)', [username, email, hash, full_name]);
    res.json({ success: true, redirect: (req.app.get('basePath') || '') + '/auth/login' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore durante la registrazione' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect((req.app.get('basePath') || '') + '/auth/login'));
});

module.exports = router;
