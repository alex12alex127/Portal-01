const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { requireAuth, requireAdmin, requireManager } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');

router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * limit;
    const countResult = await db.query('SELECT COUNT(*)::int AS total FROM users');
    const total = countResult.rows[0].total;
    const result = await db.query(
      'SELECT id, username, email, full_name, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    const totalPages = Math.ceil(total / limit) || 1;
    res.render('admin/users', {
      title: 'Gestione Utenti - Portal-01',
      activePage: 'admin',
      users: result.rows,
      pagination: { page, limit, total, totalPages }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

router.post('/users/:id/role', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { role } = req.body;
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID utente non valido' });
  if (!['admin', 'manager', 'user'].includes(role)) return res.status(400).json({ error: 'Ruolo non valido' });
  if (id === Number(req.session.userId)) return res.status(400).json({ error: 'Non puoi cambiare il tuo ruolo' });
  try {
    await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    res.json({ success: true, message: 'Ruolo aggiornato' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.post('/users/:id/toggle', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID utente non valido' });
  if (id === Number(req.session.userId)) return res.status(400).json({ error: 'Non puoi disattivare il tuo account' });
  try {
    const r = await db.query('UPDATE users SET is_active = NOT is_active WHERE id = $1 RETURNING is_active', [id]);
    res.json({ success: true, message: r.rows[0].is_active ? 'Utente attivato' : 'Utente disattivato', is_active: r.rows[0].is_active });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.delete('/users/:id', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID utente non valido' });
  if (id === Number(req.session.userId)) return res.status(400).json({ error: 'Non puoi eliminare il tuo account' });
  try {
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true, message: 'Utente eliminato' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.post('/users/:id/reset-password', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const new_password = req.body.new_password;
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID utente non valido' });
  if (!new_password || new_password.length < 8) return res.status(400).json({ error: 'Password almeno 8 caratteri' });
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(new_password)) return res.status(400).json({ error: 'Password: maiuscole, minuscole e numeri' });
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
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * limit;
    const countResult = await db.query('SELECT COUNT(*)::int AS total FROM ferie f JOIN users u ON u.id = f.user_id');
    const total = countResult.rows[0].total;
    const result = await db.query(`
      SELECT f.id, f.user_id, f.data_inizio, f.data_fine, f.giorni_totali, f.tipo, f.stato, f.note, f.created_at,
             u.username, u.full_name
      FROM ferie f
      JOIN users u ON u.id = f.user_id
      ORDER BY f.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    const soloData = (val) => {
      if (val == null) return '';
      if (typeof val === 'string') return val.slice(0, 10);
      if (typeof val.toISOString === 'function') return val.toISOString().slice(0, 10);
      return String(val).slice(0, 10);
    };
    const ferie = result.rows.map(r => ({
      ...r,
      data_inizio: soloData(r.data_inizio),
      data_fine: soloData(r.data_fine)
    }));
    const totalPages = Math.ceil(total / limit) || 1;
    res.render('admin/ferie', {
      title: 'Richieste Ferie - Portal-01',
      activePage: 'adminFerie',
      ferie,
      pagination: { page, limit, total, totalPages }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

router.post('/ferie/:id/approve', requireAuth, requireManager, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID richiesta non valido' });
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
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID richiesta non valido' });
  try {
    const r = await db.query('UPDATE ferie SET stato = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND stato = $3 RETURNING id', ['rejected', id, 'pending']);
    if (r.rows.length === 0) return res.status(400).json({ error: 'Richiesta non trovata o già gestita' });
    res.json({ success: true, message: 'Richiesta rifiutata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

// Calendario ferie admin: per ogni giorno le richieste (approvate + in attesa) con id per modifica/cancella
router.get('/ferie/calendar', requireAuth, requireManager, async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
    if (month < 1 || month > 12) return res.status(400).json({ error: 'Mese non valido' });
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const start = firstDay.toISOString().slice(0, 10);
    const end = lastDay.toISOString().slice(0, 10);
    const result = await db.query(`
      SELECT f.id, f.user_id, f.data_inizio, f.data_fine, f.giorni_totali, f.tipo, f.stato, f.note,
             u.username, u.full_name
      FROM ferie f
      JOIN users u ON u.id = f.user_id
      WHERE f.stato IN ('approved', 'pending')
        AND f.data_inizio <= $1 AND f.data_fine >= $2
    `, [end, start]);
    const soloData = (val) => {
      if (val == null) return '';
      if (typeof val === 'string') return val.slice(0, 10);
      if (typeof val.toISOString === 'function') return val.toISOString().slice(0, 10);
      return String(val).slice(0, 10);
    };
    const byDate = {};
    for (const row of result.rows) {
      const startStr = soloData(row.data_inizio);
      const endStr = soloData(row.data_fine);
      const [sy, sm, sd] = startStr.split('-').map(Number);
      const [ey, em, ed] = endStr.split('-').map(Number);
      const dStart = new Date(sy, sm - 1, sd);
      const dEnd = new Date(ey, em - 1, ed);
      const entry = {
        id: row.id,
        user_id: row.user_id,
        username: row.username,
        full_name: row.full_name,
        data_inizio: startStr,
        data_fine: endStr,
        giorni_totali: row.giorni_totali,
        tipo: row.tipo,
        stato: row.stato,
        note: row.note || ''
      };
      for (let d = new Date(dStart.getTime()); d.getTime() <= dEnd.getTime(); d.setDate(d.getDate() + 1)) {
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(entry);
      }
    }
    res.json({ year, month, byDate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

// Modifica richiesta ferie (admin/manager)
router.put('/ferie/:id', requireAuth, requireManager, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID richiesta non valido' });
  const { data_inizio, data_fine, tipo, note } = req.body || {};
  if (!data_inizio || !data_fine) return res.status(400).json({ error: 'Data inizio e data fine richieste' });
  const inizio = new Date(data_inizio);
  const fine = new Date(data_fine);
  if (inizio > fine) return res.status(400).json({ error: 'Data inizio deve essere prima della data fine' });
  const tipoVal = ['ferie', 'permesso', 'malattia'].includes(tipo) ? tipo : 'ferie';
  const giorni = Math.ceil((fine - inizio) / (1000 * 60 * 60 * 24)) + 1;
  try {
    const r = await db.query(
      'UPDATE ferie SET data_inizio = $1, data_fine = $2, giorni_totali = $3, tipo = $4, note = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING id',
      [data_inizio, data_fine, giorni, tipoVal, note || null, id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Richiesta non trovata' });
    res.json({ success: true, message: 'Richiesta aggiornata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

// Cancella (elimina) richiesta ferie (admin/manager)
router.delete('/ferie/:id', requireAuth, requireManager, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID richiesta non valido' });
  try {
    const r = await db.query('DELETE FROM ferie WHERE id = $1 RETURNING id', [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Richiesta non trovata' });
    res.json({ success: true, message: 'Richiesta cancellata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

module.exports = router;
