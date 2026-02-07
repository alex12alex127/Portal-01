const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/database');
const { validateRegister, validateLogin } = require('../middleware/validation');
const { loginLimiter, registerLimiter, apiLimiter, checkLoginAttempts, recordLoginAttempt, logLoginAttempt } = require('../middleware/security');

router.get('/login', (req, res) => {
  const base = req.app.get('basePath') || '';
  if (req.session && req.session.user) return res.redirect(base + '/dashboard');
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
  if (req.session && req.session.user) return res.redirect(base + '/dashboard');
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

router.get('/forgot-password', (req, res) => {
  const base = req.app.get('basePath') || '';
  if (req.session && req.session.user) return res.redirect(base + '/dashboard');
  res.render('auth/forgot-password', { layout: 'layouts/auth', title: 'Recupero password - Portal-01' });
});

router.post('/forgot-password', loginLimiter, apiLimiter, async (req, res) => {
  const email = (req.body && req.body.email) ? String(req.body.email).trim() : '';
  if (!email) return res.status(400).json({ error: 'Inserisci l\'email' });
  const base = req.app.get('basePath') || '';
  try {
    const r = await db.query('SELECT id, username FROM users WHERE email = $1 AND is_active = true', [email]);
    if (r.rows.length === 0) {
      return res.json({ success: true, message: 'Se l\'email è registrata, riceverai un link per reimpostare la password.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expireAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.query('INSERT INTO password_reset_tokens (user_id, token, expire_at) VALUES ($1, $2, $3)', [r.rows[0].id, token, expireAt]);
    const resetUrl = (req.protocol + '://' + req.get('host') + base + '/auth/reset-password?token=' + token);
    if (process.env.SMTP_HOST) {
      try {
        const nodemailer = require('nodemailer');
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT, 10) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
        });
        await transport.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: email,
          subject: 'Portal-01 - Recupero password',
          text: 'Clicca per reimpostare la password: ' + resetUrl + '\nIl link scade tra 1 ora.'
        });
      } catch (mailErr) {
        console.error('Invio email recupero password:', mailErr.message);
      }
    } else {
      if (process.env.NODE_ENV !== 'production') console.log('[Recupero password] Link (copia in produzione con SMTP):', resetUrl);
    }
    res.json({ success: true, message: 'Se l\'email è registrata, riceverai un link per reimpostare la password.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

router.get('/reset-password', (req, res) => {
  const base = req.app.get('basePath') || '';
  if (req.session && req.session.user) return res.redirect(base + '/dashboard');
  const token = (req.query && req.query.token) || '';
  res.render('auth/reset-password', { layout: 'layouts/auth', title: 'Nuova password - Portal-01', token });
});

router.post('/reset-password', apiLimiter, async (req, res) => {
  const { token, new_password, confirm_password } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Link non valido' });
  if (!new_password || new_password !== confirm_password) return res.status(400).json({ error: 'Le password non coincidono' });
  if (new_password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(new_password)) {
    return res.status(400).json({ error: 'Password: almeno 8 caratteri, maiuscole, minuscole, numeri' });
  }
  const base = req.app.get('basePath') || '';
  try {
    const t = await db.query('SELECT user_id FROM password_reset_tokens WHERE token = $1 AND used = false AND expire_at > NOW()', [token]);
    if (t.rows.length === 0) return res.status(400).json({ error: 'Link scaduto o già usato. Richiedi un nuovo link.' });
    const hash = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hash, t.rows[0].user_id]);
    await db.query('UPDATE password_reset_tokens SET used = true WHERE token = $1', [token]);
    res.json({ success: true, message: 'Password aggiornata.', redirect: base + '/auth/login' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

module.exports = router;
