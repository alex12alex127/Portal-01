const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const validator = require('validator');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, email, full_name, role, last_login, created_at FROM users WHERE id = $1',
      [req.session.userId]
    );
    if (result.rows.length === 0) return res.redirect((req.app.get('basePath') || '') + '/auth/logout');
    res.render('profile/index', { title: 'Profilo - Portal-01', activePage: 'profile', profile: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

router.post('/update', requireAuth, apiLimiter, (req, res, next) => {
  const { full_name, email } = req.body;
  if (!full_name || full_name.length < 2) return res.status(400).json({ error: 'Nome richiesto' });
  if (!email || !validator.isEmail(email)) return res.status(400).json({ error: 'Email non valida' });
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
    if (r.rows.length === 0) return res.status(404).json({ error: 'Utente non trovato' });
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

router.post('/notifiche-read', requireAuth, async (req, res) => {
  try {
    await db.query('UPDATE notifiche SET letta = true WHERE user_id = $1', [req.session.userId]);
    res.redirect((req.app.get('basePath') || '') + '/dashboard');
  } catch (err) {
    console.error(err);
    res.redirect((req.app.get('basePath') || '') + '/dashboard');
  }
});

router.get('/export', requireAuth, async (req, res) => {
  try {
    const user = await db.query('SELECT id, username, email, full_name, role, created_at FROM users WHERE id = $1', [req.session.userId]);
    const ferie = await db.query('SELECT data_inizio, data_fine, giorni_totali, tipo, stato, note, created_at FROM ferie WHERE user_id = $1 ORDER BY data_inizio DESC', [req.session.userId]);
    const soloData = (val) => (val == null ? '' : typeof val === 'string' ? val.slice(0, 10) : val.toISOString ? val.toISOString().slice(0, 10) : String(val).slice(0, 10));
    const exportData = {
      exportato_il: new Date().toISOString(),
      utente: user.rows[0] ? { username: user.rows[0].username, email: user.rows[0].email, full_name: user.rows[0].full_name } : null,
      ferie: ferie.rows.map(r => ({ data_inizio: soloData(r.data_inizio), data_fine: soloData(r.data_fine), giorni_totali: r.giorni_totali, tipo: r.tipo, stato: r.stato, note: r.note }))
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="portal-01-dati-' + req.session.userId + '.json"');
    res.send(JSON.stringify(exportData, null, 2));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

module.exports = router;
