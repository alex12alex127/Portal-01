const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../../config/database');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/security');
const { logAudit } = require('../../lib/audit');

router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * limit;
    const q = (req.query.q && String(req.query.q).trim()) || '';
    const roleFilter = (req.query.role && ['admin', 'manager', 'user'].includes(req.query.role)) ? req.query.role : '';
    let where = '';
    const countParams = [];
    const listParams = [];
    let n = 1;
    if (q) {
      where = ' WHERE (username ILIKE $' + n + ' OR full_name ILIKE $' + n + ' OR email ILIKE $' + n + ')';
      countParams.push('%' + q + '%');
      listParams.push('%' + q + '%');
      n++;
    }
    if (roleFilter) {
      where += (where ? ' AND' : ' WHERE') + ' role = $' + n;
      countParams.push(roleFilter);
      listParams.push(roleFilter);
      n++;
    }
    const countResult = await db.query('SELECT COUNT(*)::int AS total FROM users' + where, countParams);
    const total = countResult.rows[0].total;
    listParams.push(limit, offset);
    const result = await db.query(
      'SELECT id, username, email, full_name, role, is_active, last_login, created_at FROM users' + where + ' ORDER BY created_at DESC LIMIT $' + n + ' OFFSET $' + (n + 1),
      listParams
    );
    const totalPages = Math.ceil(total / limit) || 1;
    const repartiResult = await db.query('SELECT id, nome FROM reparti ORDER BY nome');
    const allUsersResult = await db.query('SELECT id, full_name, username FROM users WHERE is_active = true ORDER BY full_name');
    res.render('admin/users', {
      title: 'Gestione Utenti - Portal-01',
      activePage: 'admin',
      breadcrumbs: [{ label: 'Panoramica', url: '/dashboard' }, { label: 'Gestione Utenti' }],
      users: result.rows,
      pagination: { page, limit, total, totalPages },
      filtri: { q, role: roleFilter },
      repartiList: repartiResult.rows,
      allUsers: allUsersResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

router.post('/:id/role', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { role } = req.body;
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID utente non valido' });
  if (!['admin', 'manager', 'user'].includes(role)) return res.status(400).json({ error: 'Ruolo non valido' });
  if (id === Number(req.session.user.id)) return res.status(400).json({ error: 'Non puoi cambiare il tuo ruolo' });
  try {
    const prev = await db.query('SELECT username, role FROM users WHERE id = $1', [id]);
    await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    if (prev.rows.length) await logAudit(req.session.user.id, 'ruolo_cambiato', `user_id=${id} ${prev.rows[0].username} -> ${role}`, req.ip);
    res.json({ success: true, message: 'Ruolo aggiornato' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.post('/:id/toggle', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID utente non valido' });
  if (id === Number(req.session.user.id)) return res.status(400).json({ error: 'Non puoi disattivare il tuo account' });
  try {
    const r = await db.query('UPDATE users SET is_active = NOT is_active WHERE id = $1 RETURNING is_active', [id]);
    res.json({ success: true, message: r.rows[0].is_active ? 'Utente attivato' : 'Utente disattivato', is_active: r.rows[0].is_active });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.delete('/:id', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID utente non valido' });
  if (id === Number(req.session.user.id)) return res.status(400).json({ error: 'Non puoi eliminare il tuo account' });
  try {
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true, message: 'Utente eliminato' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

// Aggiorna anagrafica estesa utente
router.put('/:id/anagrafica', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID non valido' });
  const { reparto_id, responsabile_id, data_assunzione, tipo_contratto, ore_settimanali, telefono, codice_fiscale, matricola } = req.body;
  const tipiContratto = ['full-time', 'part-time', 'apprendistato', 'determinato', 'collaborazione'];
  const tipoVal = tipiContratto.includes(tipo_contratto) ? tipo_contratto : 'full-time';
  try {
    await db.query(
      `UPDATE users SET reparto_id = $1, responsabile_id = $2, data_assunzione = $3,
       tipo_contratto = $4, ore_settimanali = $5, telefono = $6, codice_fiscale = $7, matricola = $8,
       updated_at = CURRENT_TIMESTAMP WHERE id = $9`,
      [reparto_id || null, responsabile_id || null, data_assunzione || null,
       tipoVal, ore_settimanali || 40, telefono || null, codice_fiscale || null, matricola || null, id]
    );
    await logAudit(req.session.user.id, 'anagrafica_aggiornata', `user_id=${id}`, req.ip);
    res.json({ success: true, message: 'Anagrafica aggiornata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

// API: dettaglio utente con anagrafica estesa
router.get('/:id/detail', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID non valido' });
  try {
    const r = await db.query(
      `SELECT u.id, u.username, u.email, u.full_name, u.role, u.is_active, u.reparto_id, u.responsabile_id,
              u.data_assunzione, u.tipo_contratto, u.ore_settimanali, u.telefono, u.codice_fiscale, u.matricola,
              r.nome AS reparto_nome, resp.full_name AS responsabile_nome
       FROM users u
       LEFT JOIN reparti r ON r.id = u.reparto_id
       LEFT JOIN users resp ON resp.id = u.responsabile_id
       WHERE u.id = $1`, [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Utente non trovato' });
    const user = r.rows[0];
    if (user.data_assunzione) {
      user.data_assunzione = typeof user.data_assunzione === 'string' ? user.data_assunzione.slice(0, 10) : user.data_assunzione.toISOString().slice(0, 10);
    }
    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.post('/:id/reset-password', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
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

module.exports = router;
