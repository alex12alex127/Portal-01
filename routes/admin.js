const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { requireAuth, requireAdmin, requireManager } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');

router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, email, full_name, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC'
    );
    res.render('admin/users', { users: result.rows, user: req.session.user, csrfToken: req.session.csrfToken });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

router.post('/users/:id/role', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!['admin', 'manager', 'user'].includes(role)) return res.status(400).json({ error: 'Ruolo non valido' });
  if (parseInt(id) === req.session.userId) return res.status(400).json({ error: 'Non puoi cambiare il tuo ruolo' });
  try {
    await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    res.json({ success: true, message: 'Ruolo aggiornato' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.post('/users/:id/toggle', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.session.userId) return res.status(400).json({ error: 'Non puoi disattivare il tuo account' });
  try {
    const r = await db.query('UPDATE users SET is_active = NOT is_active WHERE id = $1 RETURNING is_active', [id]);
    res.json({ success: true, message: r.rows[0].is_active ? 'Utente attivato' : 'Utente disattivato', is_active: r.rows[0].is_active });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.delete('/users/:id', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.session.userId) return res.status(400).json({ error: 'Non puoi eliminare il tuo account' });
  try {
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true, message: 'Utente eliminato' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.post('/users/:id/reset-password', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  const { id } = req.params;
  const new_password = req.body.new_password;
  if (!new_password || new_password.length < 8) return res.status(400).json({ error: 'Password almeno 8 caratteri' });
  try {
    const hash = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hash, id]);
    res.json({ success: true, message: 'Password reimpostata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

// Richieste ferie — admin/manager possono approvare o rifiutare
router.get('/ferie', requireAuth, requireManager, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT f.id, f.user_id, f.data_inizio, f.data_fine, f.giorni_totali, f.tipo, f.stato, f.note, f.created_at,
             u.username, u.full_name
      FROM ferie f
      JOIN users u ON u.id = f.user_id
      ORDER BY f.created_at DESC
    `);
    res.render('admin/ferie', { ferie: result.rows, user: req.session.user, csrfToken: req.session.csrfToken });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

router.post('/ferie/:id/approve', requireAuth, requireManager, apiLimiter, async (req, res) => {
  const { id } = req.params;
  try {
    const r = await db.query('UPDATE ferie SET stato = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND stato = $3 RETURNING id', ['approved', id, 'pending']);
    if (r.rows.length === 0) return res.status(400).json({ error: 'Richiesta non trovata o già gestita' });
    res.json({ success: true, message: 'Richiesta approvata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.post('/ferie/:id/reject', requireAuth, requireManager, apiLimiter, async (req, res) => {
  const { id } = req.params;
  try {
    const r = await db.query('UPDATE ferie SET stato = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND stato = $3 RETURNING id', ['rejected', id, 'pending']);
    if (r.rows.length === 0) return res.status(400).json({ error: 'Richiesta non trovata o già gestita' });
    res.json({ success: true, message: 'Richiesta rifiutata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

module.exports = router;
