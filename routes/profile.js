const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, email, full_name, role, last_login, created_at FROM users WHERE id = $1',
      [req.session.userId]
    );
    if (result.rows.length === 0) return res.redirect('/auth/logout');
    res.render('profile/index', { profile: result.rows[0], user: req.session.user, csrfToken: req.session.csrfToken });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

router.post('/update', requireAuth, apiLimiter, (req, res, next) => {
  const { full_name, email } = req.body;
  if (!full_name || full_name.length < 2) return res.status(400).json({ error: 'Nome richiesto' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Email non valida' });
  req._profileUpdate = { full_name, email };
  next();
}, async (req, res) => {
  const { full_name, email } = req._profileUpdate;
  try {
    const exist = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.session.userId]);
    if (exist.rows.length > 0) return res.status(400).json({ error: 'Email già in uso' });
    await db.query('UPDATE users SET full_name = $1, email = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', [full_name, email, req.session.userId]);
    req.session.user.full_name = full_name;
    req.session.user.email = email;
    res.json({ success: true, message: 'Profilo aggiornato' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.post('/change-password', requireAuth, apiLimiter, async (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;
  if (!current_password || !new_password || new_password !== confirm_password) {
    return res.status(400).json({ error: 'Campi non validi o password non coincidono' });
  }
  if (new_password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(new_password)) {
    return res.status(400).json({ error: 'Nuova password: almeno 8 caratteri, maiuscole, minuscole, numeri' });
  }
  try {
    const r = await db.query('SELECT password FROM users WHERE id = $1', [req.session.userId]);
    const ok = await bcrypt.compare(current_password, r.rows[0].password);
    if (!ok) return res.status(401).json({ error: 'Password corrente errata' });
    const hash = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.session.userId]);
    res.json({ success: true, message: 'Password cambiata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

module.exports = router;
