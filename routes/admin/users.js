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
    res.render('admin/users', {
      title: 'Gestione Utenti - Portal-01',
      activePage: 'admin',
      breadcrumbs: [{ label: 'Panoramica', url: '/dashboard' }, { label: 'Gestione Utenti' }],
      users: result.rows,
      pagination: { page, limit, total, totalPages },
      filtri: { q, role: roleFilter }
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
