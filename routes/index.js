const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { soloData } = require('../lib/helpers');
const { getScadenzeSicurezza } = require('../lib/sicurezza');
const { getSaldoFerie } = require('../lib/budget_ferie');

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
    const userId = req.session.user.id;
    const isAdmin = req.session.user.role === 'admin';
    const isManager = req.session.user.role === 'manager';

    // 1. Riepilogo ferie personali
    const summaryResult = await db.query(
      `SELECT stato, COUNT(*)::int AS n, COALESCE(SUM(giorni_totali), 0)::int AS giorni FROM ferie WHERE user_id = $1 AND EXTRACT(YEAR FROM data_inizio) = $2 GROUP BY stato`,
      [userId, year]
    );
    const summary = { pending: 0, approved: 0, rejected: 0, giorniPending: 0, giorniApproved: 0, giorniRejected: 0 };
    summaryResult.rows.forEach(row => {
      summary[row.stato] = row.n;
      summary['giorni' + row.stato.charAt(0).toUpperCase() + row.stato.slice(1)] = row.giorni;
    });

    // 2. Budget ferie (giorni da utilizzare)
    let saldoFerie = { anno: year, giorni_spettanti: 0, giorni_usati: 0, giorni_pendenti: 0, giorni_residui: 0, budget_configurato: false };
    try { saldoFerie = await getSaldoFerie(userId, year); } catch (_) {}

    // 3. Notifiche approvazioni (solo tipo ferie_approve, ferie_approved, ferie_rejected)
    const notificheApprResult = await db.query(
      `SELECT id, tipo, titolo, messaggio, letta, created_at FROM notifiche
       WHERE user_id = $1 AND tipo IN ('ferie_approve','ferie_approved','ferie_rejected','ferie_create')
       ORDER BY created_at DESC LIMIT 10`,
      [userId]
    );
    const notificheApprovazioni = notificheApprResult.rows.map(n => ({ ...n, created_at: n.created_at ? new Date(n.created_at).toLocaleDateString('it-IT') : '' }));

    // 4. Tutte le notifiche recenti
    const notificheResult = await db.query(
      'SELECT id, tipo, titolo, messaggio, letta, created_at FROM notifiche WHERE user_id = $1 ORDER BY created_at DESC LIMIT 15',
      [userId]
    );
    const notifiche = notificheResult.rows.map(n => ({ ...n, created_at: n.created_at ? new Date(n.created_at).toLocaleDateString('it-IT') : '' }));

    // 5. Avvisi staff (info, warning, urgent, success)
    const avvisiResult = await db.query(`
      SELECT id, titolo, tipo, contenuto, in_evidenza, created_at FROM avvisi
      WHERE (visibile_da IS NULL OR visibile_da <= CURRENT_DATE) AND (visibile_fino IS NULL OR visibile_fino >= CURRENT_DATE)
      ORDER BY in_evidenza DESC, CASE tipo WHEN 'urgent' THEN 0 WHEN 'warning' THEN 1 WHEN 'success' THEN 2 ELSE 3 END, created_at DESC LIMIT 8
    `);
    const avvisiDashboard = avvisiResult.rows.map(a => ({ ...a, created_at: a.created_at ? new Date(a.created_at).toLocaleDateString('it-IT') : '' }));

    // 6. Scadenze sicurezza personali (DPI + corsi)
    let sicurezzaScadenze = { formazioni: [], dpi: [], totale: 0 };
    try {
      const scadRaw = await getScadenzeSicurezza(60);
      sicurezzaScadenze = {
        formazioni: scadRaw.formazioni.filter(s => s.user_id === userId).map(s => ({ ...s, data_scadenza: soloData(s.data_scadenza), scaduto: new Date(s.data_scadenza) < new Date() })),
        dpi: scadRaw.dpi.filter(s => s.user_id === userId).map(s => ({ ...s, data_scadenza: soloData(s.data_scadenza), scaduto: new Date(s.data_scadenza) < new Date() })),
        totale: 0
      };
      sicurezzaScadenze.totale = sicurezzaScadenze.formazioni.length + sicurezzaScadenze.dpi.length;
    } catch (_) {}

    // 7. Calendario ferie: chi è in ferie questo mese (tutti gli utenti, ferie approvate)
    const oggi = new Date();
    const meseInizio = new Date(oggi.getFullYear(), oggi.getMonth(), 1).toISOString().slice(0, 10);
    const meseFine = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0).toISOString().slice(0, 10);
    let calendarioFerie = [];
    try {
      const calResult = await db.query(
        `SELECT f.id, f.data_inizio, f.data_fine, f.tipo, f.giorni_totali, u.full_name, u.username
         FROM ferie f JOIN users u ON u.id = f.user_id
         WHERE f.stato = 'approved' AND f.data_inizio <= $2 AND f.data_fine >= $1
         ORDER BY f.data_inizio`,
        [meseInizio, meseFine]
      );
      calendarioFerie = calResult.rows.map(r => ({
        ...r,
        data_inizio: soloData(r.data_inizio),
        data_fine: soloData(r.data_fine)
      }));
    } catch (_) {}

    // 8. Ultime richieste personali
    const ultimeRichieste = await db.query(
      'SELECT id, data_inizio, data_fine, tipo, stato, giorni_totali FROM ferie WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
      [userId]
    );

    // 9. Ferie da approvare (per admin/manager)
    let ferieDaApprovare = [];
    if (isAdmin || isManager) {
      try {
        const pendResult = await db.query(
          `SELECT f.id, f.data_inizio, f.data_fine, f.tipo, f.giorni_totali, u.full_name, u.username
           FROM ferie f JOIN users u ON u.id = f.user_id
           WHERE f.stato = 'pending' ORDER BY f.created_at DESC LIMIT 10`
        );
        ferieDaApprovare = pendResult.rows.map(r => ({
          ...r,
          data_inizio: soloData(r.data_inizio),
          data_fine: soloData(r.data_fine)
        }));
      } catch (_) {}
    }

    res.render('dashboard', {
      title: 'Panoramica - Portal-01',
      activePage: 'dashboard',
      breadcrumbs: [{ label: 'Panoramica' }],
      summary: { year, ...summary },
      saldoFerie,
      notificheApprovazioni,
      notifiche,
      avvisiDashboard,
      sicurezzaScadenze,
      calendarioFerie,
      meseCorrente: oggi.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }),
      giorniMese: new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0).getDate(),
      primoGiornoMese: new Date(oggi.getFullYear(), oggi.getMonth(), 1).getDay(),
      annoMese: { anno: oggi.getFullYear(), mese: oggi.getMonth() + 1 },
      ultimeRichieste: ultimeRichieste.rows.map(r => ({ ...r, data_inizio: soloData(r.data_inizio), data_fine: soloData(r.data_fine) })),
      ferieDaApprovare
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

module.exports = router;
