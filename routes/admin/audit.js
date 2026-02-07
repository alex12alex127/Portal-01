const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { requireAuth, requireAdmin } = require('../../middleware/auth');

router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * limit;
    const userFilter = parseInt(req.query.user_id, 10);
    const azioneFilter = (req.query.azione && String(req.query.azione).trim()) || '';
    const dataFilter = (req.query.data && String(req.query.data).trim()) || '';
    let where = '';
    const countParams = [];
    const listParams = [];
    let n = 1;
    if (!Number.isNaN(userFilter) && userFilter > 0) {
      where = ' WHERE al.user_id = $' + n;
      countParams.push(userFilter);
      listParams.push(userFilter);
      n++;
    }
    if (azioneFilter) {
      where += (where ? ' AND' : ' WHERE') + ' al.azione ILIKE $' + n;
      countParams.push('%' + azioneFilter + '%');
      listParams.push('%' + azioneFilter + '%');
      n++;
    }
    if (dataFilter) {
      where += (where ? ' AND' : ' WHERE') + ' al.created_at::date = $' + n;
      countParams.push(dataFilter);
      listParams.push(dataFilter);
      n++;
    }
    const countResult = await db.query('SELECT COUNT(*)::int AS total FROM audit_log al' + where, countParams);
    const total = countResult.rows[0].total;
    listParams.push(limit, offset);
    const result = await db.query(
      'SELECT al.id, al.user_id, al.azione, al.dettaglio, al.ip, al.created_at, u.username, u.full_name FROM audit_log al LEFT JOIN users u ON al.user_id = u.id' + where + ' ORDER BY al.created_at DESC LIMIT $' + n + ' OFFSET $' + (n + 1),
      listParams
    );
    const totalPages = Math.ceil(total / limit) || 1;
    const usersList = await db.query('SELECT id, username, full_name FROM users ORDER BY username');
    res.render('admin/audit', {
      title: 'Audit Log - Portal-01',
      activePage: 'adminAudit',
      breadcrumbs: [{ label: 'Panoramica', url: '/dashboard' }, { label: 'Audit Log' }],
      logs: result.rows,
      pagination: { page, limit, total, totalPages },
      filtri: { user_id: Number.isNaN(userFilter) ? '' : userFilter, azione: azioneFilter, data: dataFilter },
      usersList: usersList.rows
    });
  } catch (err) {
    console.error('[admin audit]', err);
    res.status(500).send('Errore del server');
  }
});

module.exports = router;
