const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { requireAuth, requireManager } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/security');
const { logAudit } = require('../../lib/audit');
const { soloData } = require('../../lib/helpers');
const {
  getFormazioni, creaFormazione, aggiornaFormazione, eliminaFormazione,
  getDpiConsegne, creaDpiConsegna, aggiornaDpiConsegna, eliminaDpiConsegna,
  getScadenzeSicurezza, getStatisticheSicurezza
} = require('../../lib/sicurezza');

// GET /admin/sicurezza — pagina principale
router.get('/', requireAuth, requireManager, async (req, res) => {
  try {
    const tab = req.query.tab || 'formazioni';
    const userFilter = parseInt(req.query.user_id, 10);
    const filtri = { user_id: Number.isNaN(userFilter) ? '' : userFilter };

    const [formazioni, dpiConsegne, stats, scadenze, usersResult] = await Promise.all([
      getFormazioni(filtri.user_id ? { user_id: filtri.user_id } : {}),
      getDpiConsegne(filtri.user_id ? { user_id: filtri.user_id } : {}),
      getStatisticheSicurezza(),
      getScadenzeSicurezza(30),
      db.query('SELECT id, username, full_name FROM users WHERE is_active = true ORDER BY full_name')
    ]);

    const fmt = r => ({ ...r, data_corso: r.data_corso ? soloData(r.data_corso) : '', data_scadenza: r.data_scadenza ? soloData(r.data_scadenza) : '' });
    const fmtDpi = r => ({ ...r, data_consegna: soloData(r.data_consegna), data_scadenza: r.data_scadenza ? soloData(r.data_scadenza) : '' });

    res.render('admin/sicurezza', {
      title: 'Sicurezza sul Lavoro - Portal-01',
      activePage: 'adminSicurezza',
      breadcrumbs: [{ label: 'Panoramica', url: '/dashboard' }, { label: 'Sicurezza sul Lavoro' }],
      tab,
      filtri,
      formazioni: formazioni.map(fmt),
      dpiConsegne: dpiConsegne.map(fmtDpi),
      stats,
      scadenze: {
        formazioni: scadenze.formazioni.map(s => ({ ...s, data_scadenza: soloData(s.data_scadenza) })),
        dpi: scadenze.dpi.map(s => ({ ...s, data_scadenza: soloData(s.data_scadenza) })),
        totale: scadenze.totale
      },
      usersList: usersResult.rows
    });
  } catch (err) {
    console.error('[admin sicurezza]', err);
    res.status(500).send('Errore del server');
  }
});

// ===== FORMAZIONI CRUD =====
router.post('/formazioni', requireAuth, requireManager, apiLimiter, async (req, res) => {
  try {
    const { user_id, tipo, descrizione, ente_formatore, data_corso, data_scadenza, ore, stato } = req.body;
    if (!user_id || !tipo || !data_corso) return res.status(400).json({ error: 'Dipendente, tipo e data corso obbligatori' });
    await creaFormazione({ user_id, tipo, descrizione, ente_formatore, data_corso, data_scadenza: data_scadenza || null, ore: ore ? parseInt(ore, 10) : null, stato: stato || 'valido', created_by: req.session.user.id });
    await logAudit(req.session.user.id, 'formazione_creata', `Formazione "${tipo}" per utente ${user_id}`, req.ip);
    res.json({ success: true, message: 'Formazione registrata' });
  } catch (err) {
    console.error('[admin formazione create]', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

router.put('/formazioni/:id', requireAuth, requireManager, apiLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID non valido' });
    const { tipo, descrizione, ente_formatore, data_corso, data_scadenza, ore, stato } = req.body;
    if (!tipo || !data_corso) return res.status(400).json({ error: 'Tipo e data corso obbligatori' });
    const updated = await aggiornaFormazione(id, { tipo, descrizione, ente_formatore, data_corso, data_scadenza: data_scadenza || null, ore: ore ? parseInt(ore, 10) : null, stato: stato || 'valido' });
    if (!updated) return res.status(404).json({ error: 'Formazione non trovata' });
    await logAudit(req.session.user.id, 'formazione_aggiornata', `Formazione #${id}`, req.ip);
    res.json({ success: true, message: 'Formazione aggiornata' });
  } catch (err) {
    console.error('[admin formazione update]', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

router.delete('/formazioni/:id', requireAuth, requireManager, apiLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID non valido' });
    const deleted = await eliminaFormazione(id);
    if (!deleted) return res.status(404).json({ error: 'Formazione non trovata' });
    await logAudit(req.session.user.id, 'formazione_eliminata', `Formazione #${id}`, req.ip);
    res.json({ success: true, message: 'Formazione eliminata' });
  } catch (err) {
    console.error('[admin formazione delete]', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

// ===== DPI CRUD =====
router.post('/dpi', requireAuth, requireManager, apiLimiter, async (req, res) => {
  try {
    const { user_id, tipo_dpi, descrizione, taglia, quantita, data_consegna, data_scadenza, lotto, note } = req.body;
    if (!user_id || !tipo_dpi || !data_consegna) return res.status(400).json({ error: 'Dipendente, tipo DPI e data consegna obbligatori' });
    await creaDpiConsegna({ user_id, tipo_dpi, descrizione, taglia, quantita: quantita ? parseInt(quantita, 10) : 1, data_consegna, data_scadenza: data_scadenza || null, lotto, note, consegnato_da: req.session.user.id });
    await logAudit(req.session.user.id, 'dpi_consegnato', `DPI "${tipo_dpi}" a utente ${user_id}`, req.ip);
    res.json({ success: true, message: 'DPI registrato' });
  } catch (err) {
    console.error('[admin dpi create]', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

router.put('/dpi/:id', requireAuth, requireManager, apiLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID non valido' });
    const { tipo_dpi, descrizione, taglia, quantita, data_consegna, data_scadenza, lotto, stato, note } = req.body;
    if (!tipo_dpi || !data_consegna) return res.status(400).json({ error: 'Tipo DPI e data consegna obbligatori' });
    const updated = await aggiornaDpiConsegna(id, { tipo_dpi, descrizione, taglia, quantita: quantita ? parseInt(quantita, 10) : 1, data_consegna, data_scadenza: data_scadenza || null, lotto, stato: stato || 'consegnato', note });
    if (!updated) return res.status(404).json({ error: 'DPI non trovato' });
    await logAudit(req.session.user.id, 'dpi_aggiornato', `DPI #${id}`, req.ip);
    res.json({ success: true, message: 'DPI aggiornato' });
  } catch (err) {
    console.error('[admin dpi update]', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

router.delete('/dpi/:id', requireAuth, requireManager, apiLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID non valido' });
    const deleted = await eliminaDpiConsegna(id);
    if (!deleted) return res.status(404).json({ error: 'DPI non trovato' });
    await logAudit(req.session.user.id, 'dpi_eliminato', `DPI #${id}`, req.ip);
    res.json({ success: true, message: 'DPI eliminato' });
  } catch (err) {
    console.error('[admin dpi delete]', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

// API scadenze (per dashboard)
router.get('/scadenze', requireAuth, requireManager, async (req, res) => {
  try {
    const giorni = parseInt(req.query.giorni, 10) || 30;
    const scadenze = await getScadenzeSicurezza(giorni);
    res.json({ success: true, scadenze });
  } catch (err) {
    console.error('[admin sicurezza scadenze]', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

module.exports = router;
