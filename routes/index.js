const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { soloData } = require('../lib/helpers');

router.get('/', (req, res) => {
  const base = req.app.get('basePath') || '';
  if (req.session && req.session.user) return res.redirect(base + '/dashboard');
  res.redirect(base + '/auth/login');
});

router.get('/health', (req, res) => {
  res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
});

router.get('/health/db', async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ ok: false, db: 'disconnected', error: 'DATABASE_URL non configurata' });
  try {
    await db.query('SELECT 1');
    res.status(200).json({ ok: true, db: 'connected' });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'disconnected', error: err.message });
  }
});

router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const summaryResult = await db.query(
      `SELECT stato, COUNT(*)::int AS n, COALESCE(SUM(giorni_totali), 0)::int AS giorni FROM ferie WHERE user_id = $1 AND EXTRACT(YEAR FROM data_inizio) = $2 GROUP BY stato`,
      [req.session.user.id, year]
    );
    const summary = { pending: 0, approved: 0, rejected: 0, giorniPending: 0, giorniApproved: 0, giorniRejected: 0 };
    summaryResult.rows.forEach(row => {
      summary[row.stato] = row.n;
      summary['giorni' + row.stato.charAt(0).toUpperCase() + row.stato.slice(1)] = row.giorni;
    });
    const ultimeRichieste = await db.query(
      'SELECT id, data_inizio, data_fine, tipo, stato, giorni_totali FROM ferie WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
      [req.session.user.id]
    );
    const notificheResult = await db.query(
      'SELECT id, tipo, titolo, messaggio, letta, created_at FROM notifiche WHERE user_id = $1 ORDER BY created_at DESC LIMIT 15',
      [req.session.user.id]
    );
    const notifiche = notificheResult.rows.map(n => ({ ...n, created_at: n.created_at ? new Date(n.created_at).toLocaleDateString('it-IT') : '' }));
    const avvisiResult = await db.query(`
      SELECT id, titolo, tipo, in_evidenza, created_at FROM avvisi
      WHERE (visibile_da IS NULL OR visibile_da <= CURRENT_DATE) AND (visibile_fino IS NULL OR visibile_fino >= CURRENT_DATE)
      ORDER BY in_evidenza DESC, created_at DESC LIMIT 5
    `);
    const avvisiDashboard = avvisiResult.rows.map(a => ({ ...a, created_at: a.created_at ? new Date(a.created_at).toLocaleDateString('it-IT') : '' }));
    res.render('dashboard', {
      title: 'Panoramica - Portal-01',
      activePage: 'dashboard',
      breadcrumbs: [{ label: 'Panoramica' }],
      summary: { year, ...summary },
      ultimeRichieste: ultimeRichieste.rows.map(r => ({ ...r, data_inizio: soloData(r.data_inizio), data_fine: soloData(r.data_fine) })),
      notifiche,
      avvisiDashboard: avvisiDashboard
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

module.exports = router;
