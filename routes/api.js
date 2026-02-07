const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');

// API Documentation endpoint
router.get('/', (req, res) => {
  const base = (req.app.get('basePath') || '') + '/api/v1';
  res.json({
    name: 'Portal-01 API',
    version: '1.0.0',
    description: 'API REST per Portal-01 - Gestione Ferie e Avvisi',
    endpoints: {
      'GET /api/v1': 'Documentazione API',
      'GET /api/v1/me': 'Profilo utente corrente',
      'GET /api/v1/ferie': 'Lista ferie utente corrente',
      'GET /api/v1/ferie/:id': 'Dettaglio richiesta ferie',
      'GET /api/v1/ferie/summary': 'Riepilogo ferie anno corrente',
      'GET /api/v1/avvisi': 'Lista avvisi visibili',
      'GET /api/v1/avvisi/:id': 'Dettaglio avviso',
      'GET /api/v1/notifiche': 'Lista notifiche utente',
      'GET /api/v1/notifiche/count': 'Conteggio notifiche non lette',
      'GET /api/v1/stats': 'Statistiche generali (admin)'
    },
    authentication: 'Session-based. Effettua login via /auth/login prima di usare le API.',
    base_url: base
  });
});

// GET /api/v1/me - Profilo utente corrente
router.get('/me', requireAuth, async (req, res) => {
  try {
    const r = await db.query(
      'SELECT id, username, email, full_name, role, last_login, created_at FROM users WHERE id = $1',
      [req.session.user.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Utente non trovato' });
    res.json({ success: true, user: r.rows[0] });
  } catch (err) {
    console.error('[api me]', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

// GET /api/v1/ferie - Lista ferie utente corrente
router.get('/ferie', requireAuth, apiLimiter, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const stato = req.query.stato;
    let query = 'SELECT * FROM ferie WHERE user_id = $1';
    const params = [req.session.user.id];
    let n = 2;
    if (stato && ['pending', 'approved', 'rejected'].includes(stato)) {
      query += ` AND stato = $${n}`;
      params.push(stato);
      n++;
    }
    query += ' ORDER BY data_inizio DESC';
    params.push(limit, offset);
    query += ` LIMIT $${n} OFFSET $${n + 1}`;
    const r = await db.query(query, params);
    const soloData = (val) => (val == null ? '' : typeof val === 'string' ? val.slice(0, 10) : typeof val.toISOString === 'function' ? val.toISOString().slice(0, 10) : String(val).slice(0, 10));
    res.json({
      success: true,
      ferie: r.rows.map(f => ({ ...f, data_inizio: soloData(f.data_inizio), data_fine: soloData(f.data_fine) })),
      count: r.rows.length
    });
  } catch (err) {
    console.error('[api ferie]', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

// GET /api/v1/ferie/summary - Riepilogo ferie anno
router.get('/ferie/summary', requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const r = await db.query(
      `SELECT stato, COUNT(*)::int AS n, COALESCE(SUM(giorni_totali),0)::int AS giorni FROM ferie WHERE user_id = $1 AND EXTRACT(YEAR FROM data_inizio) = $2 GROUP BY stato`,
      [req.session.user.id, year]
    );
    const summary = { year, pending: 0, approved: 0, rejected: 0, giorniPending: 0, giorniApproved: 0, giorniRejected: 0 };
    r.rows.forEach(row => {
      summary[row.stato] = row.n;
      summary['giorni' + row.stato.charAt(0).toUpperCase() + row.stato.slice(1)] = row.giorni;
    });
    res.json({ success: true, summary });
  } catch (err) {
    console.error('[api ferie summary]', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

// GET /api/v1/ferie/:id - Dettaglio richiesta
router.get('/ferie/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID non valido' });
  try {
    const r = await db.query('SELECT * FROM ferie WHERE id = $1 AND user_id = $2', [id, req.session.user.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Richiesta non trovata' });
    res.json({ success: true, ferie: r.rows[0] });
  } catch (err) {
    console.error('[api ferie detail]', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

// GET /api/v1/avvisi - Lista avvisi visibili
router.get('/avvisi', requireAuth, async (req, res) => {
  try {
    const r = await db.query(`
      SELECT a.id, a.titolo, a.contenuto, a.tipo, a.in_evidenza, a.created_at
      FROM avvisi a
      WHERE (a.visibile_da IS NULL OR a.visibile_da <= CURRENT_DATE)
        AND (a.visibile_fino IS NULL OR a.visibile_fino >= CURRENT_DATE)
      ORDER BY a.in_evidenza DESC, a.created_at DESC
    `);
    res.json({ success: true, avvisi: r.rows, count: r.rows.length });
  } catch (err) {
    console.error('[api avvisi]', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

// GET /api/v1/avvisi/:id - Dettaglio avviso
router.get('/avvisi/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID non valido' });
  try {
    const r = await db.query('SELECT * FROM avvisi WHERE id = $1', [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Avviso non trovato' });
    res.json({ success: true, avviso: r.rows[0] });
  } catch (err) {
    console.error('[api avviso detail]', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

// GET /api/v1/notifiche - Lista notifiche
router.get('/notifiche', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const r = await db.query(
      'SELECT id, tipo, titolo, messaggio, letta, created_at FROM notifiche WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [req.session.user.id, limit]
    );
    res.json({ success: true, notifiche: r.rows, count: r.rows.length });
  } catch (err) {
    console.error('[api notifiche]', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

// GET /api/v1/notifiche/count - Conteggio non lette
router.get('/notifiche/count', requireAuth, async (req, res) => {
  try {
    const r = await db.query('SELECT COUNT(*)::int AS count FROM notifiche WHERE user_id = $1 AND letta = false', [req.session.user.id]);
    res.json({ success: true, count: r.rows[0].count });
  } catch (err) {
    console.error('[api notifiche count]', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

// GET /api/v1/stats - Statistiche generali (solo admin)
router.get('/stats', requireAuth, async (req, res) => {
  if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Accesso negato' });
  try {
    const [users, ferie, avvisi, notifiche] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS total, COUNT(CASE WHEN is_active THEN 1 END)::int AS attivi FROM users'),
      db.query(`SELECT stato, COUNT(*)::int AS n, COALESCE(SUM(giorni_totali),0)::int AS giorni FROM ferie WHERE EXTRACT(YEAR FROM data_inizio) = $1 GROUP BY stato`, [new Date().getFullYear()]),
      db.query('SELECT COUNT(*)::int AS total FROM avvisi'),
      db.query('SELECT COUNT(*)::int AS total FROM notifiche WHERE letta = false')
    ]);
    const ferieStats = {};
    ferie.rows.forEach(r => { ferieStats[r.stato] = { count: r.n, giorni: r.giorni }; });
    res.json({
      success: true,
      stats: {
        users: users.rows[0],
        ferie: ferieStats,
        avvisi: avvisi.rows[0].total,
        notifiche_non_lette: notifiche.rows[0].total,
        year: new Date().getFullYear()
      }
    });
  } catch (err) {
    console.error('[api stats]', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

module.exports = router;
