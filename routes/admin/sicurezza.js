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
  getInfortuni, creaInfortunio, aggiornaInfortunio, eliminaInfortunio,
  getDocumentiSicurezza, creaDocumentoSicurezza, aggiornaDocumentoSicurezza, eliminaDocumentoSicurezza,
  getScadenzeSicurezza, getStatisticheSicurezza
} = require('../../lib/sicurezza');

// GET /admin/sicurezza — pagina principale
router.get('/', requireAuth, requireManager, async (req, res) => {
  try {
    const tab = req.query.tab || 'formazioni';
    const userFilter = parseInt(req.query.user_id, 10);
    const filtri = { user_id: Number.isNaN(userFilter) ? '' : userFilter };

    const [formazioni, dpiConsegne, infortuni, documenti, stats, scadenze, usersResult] = await Promise.all([
      getFormazioni(filtri.user_id ? { user_id: filtri.user_id } : {}),
      getDpiConsegne(filtri.user_id ? { user_id: filtri.user_id } : {}),
      getInfortuni(filtri.user_id ? { user_id: filtri.user_id } : {}),
      getDocumentiSicurezza({}),
      getStatisticheSicurezza(),
      getScadenzeSicurezza(30),
      db.query('SELECT id, username, full_name FROM users WHERE is_active = true ORDER BY full_name')
    ]);

    const fmt = r => ({ ...r, data_corso: r.data_corso ? soloData(r.data_corso) : '', data_scadenza: r.data_scadenza ? soloData(r.data_scadenza) : '' });
    const fmtDpi = r => ({ ...r, data_consegna: soloData(r.data_consegna), data_scadenza: r.data_scadenza ? soloData(r.data_scadenza) : '' });
    const fmtInf = r => ({ ...r, data_evento: soloData(r.data_evento), data_rientro: r.data_rientro ? soloData(r.data_rientro) : '' });
    const fmtDoc = r => ({ ...r, data_approvazione: r.data_approvazione ? soloData(r.data_approvazione) : '', data_scadenza: r.data_scadenza ? soloData(r.data_scadenza) : '' });

    res.render('admin/sicurezza', {
      title: 'Sicurezza sul Lavoro - Portal-01',
      activePage: 'adminSicurezza',
      breadcrumbs: [{ label: 'Panoramica', url: '/dashboard' }, { label: 'Sicurezza sul Lavoro' }],
      tab,
      filtri,
      formazioni: formazioni.map(fmt),
      dpiConsegne: dpiConsegne.map(fmtDpi),
      infortuni: infortuni.map(fmtInf),
      documenti: documenti.map(fmtDoc),
      stats,
      scadenze: {
        formazioni: scadenze.formazioni.map(s => ({ ...s, data_scadenza: soloData(s.data_scadenza) })),
        dpi: scadenze.dpi.map(s => ({ ...s, data_scadenza: soloData(s.data_scadenza) })),
        documenti: scadenze.documenti.map(s => ({ ...s, data_scadenza: soloData(s.data_scadenza) })),
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

// ===== INFORTUNI CRUD =====
router.post('/infortuni', requireAuth, requireManager, apiLimiter, async (req, res) => {
  try {
    const { user_id, data_evento, ora_evento, luogo, descrizione, tipo_lesione, parte_corpo, giorni_prognosi, data_rientro, testimoni, provvedimenti, denunciato_inail, numero_pratica, stato } = req.body;
    if (!user_id || !data_evento || !descrizione) return res.status(400).json({ error: 'Dipendente, data evento e descrizione obbligatori' });
    await creaInfortunio({ user_id, data_evento, ora_evento, luogo, descrizione, tipo_lesione, parte_corpo, giorni_prognosi: giorni_prognosi ? parseInt(giorni_prognosi, 10) : 0, data_rientro: data_rientro || null, testimoni, provvedimenti, denunciato_inail: denunciato_inail === 'true' || denunciato_inail === true, numero_pratica, stato: stato || 'aperto', created_by: req.session.user.id });
    await logAudit(req.session.user.id, 'infortunio_registrato', `Infortunio utente ${user_id} del ${data_evento}`, req.ip);
    res.json({ success: true, message: 'Infortunio registrato' });
  } catch (err) {
    console.error('[admin infortunio create]', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

router.put('/infortuni/:id', requireAuth, requireManager, apiLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID non valido' });
    const { data_evento, ora_evento, luogo, descrizione, tipo_lesione, parte_corpo, giorni_prognosi, data_rientro, testimoni, provvedimenti, denunciato_inail, numero_pratica, stato } = req.body;
    if (!data_evento || !descrizione) return res.status(400).json({ error: 'Data evento e descrizione obbligatori' });
    const updated = await aggiornaInfortunio(id, { data_evento, ora_evento, luogo, descrizione, tipo_lesione, parte_corpo, giorni_prognosi: giorni_prognosi ? parseInt(giorni_prognosi, 10) : 0, data_rientro: data_rientro || null, testimoni, provvedimenti, denunciato_inail: denunciato_inail === 'true' || denunciato_inail === true, numero_pratica, stato: stato || 'aperto' });
    if (!updated) return res.status(404).json({ error: 'Infortunio non trovato' });
    await logAudit(req.session.user.id, 'infortunio_aggiornato', `Infortunio #${id}`, req.ip);
    res.json({ success: true, message: 'Infortunio aggiornato' });
  } catch (err) {
    console.error('[admin infortunio update]', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

router.delete('/infortuni/:id', requireAuth, requireManager, apiLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID non valido' });
    const deleted = await eliminaInfortunio(id);
    if (!deleted) return res.status(404).json({ error: 'Infortunio non trovato' });
    await logAudit(req.session.user.id, 'infortunio_eliminato', `Infortunio #${id}`, req.ip);
    res.json({ success: true, message: 'Infortunio eliminato' });
  } catch (err) {
    console.error('[admin infortunio delete]', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

// ===== DOCUMENTI SICUREZZA CRUD =====
router.post('/documenti', requireAuth, requireManager, apiLimiter, async (req, res) => {
  try {
    const { titolo, categoria, descrizione, versione, data_approvazione, data_scadenza } = req.body;
    if (!titolo || !categoria) return res.status(400).json({ error: 'Titolo e categoria obbligatori' });
    await creaDocumentoSicurezza({ titolo, categoria, descrizione, versione, data_approvazione: data_approvazione || null, data_scadenza: data_scadenza || null, created_by: req.session.user.id });
    await logAudit(req.session.user.id, 'doc_sicurezza_creato', `Documento "${titolo}"`, req.ip);
    res.json({ success: true, message: 'Documento registrato' });
  } catch (err) {
    console.error('[admin doc sicurezza create]', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

router.put('/documenti/:id', requireAuth, requireManager, apiLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID non valido' });
    const { titolo, categoria, descrizione, versione, data_approvazione, data_scadenza } = req.body;
    if (!titolo || !categoria) return res.status(400).json({ error: 'Titolo e categoria obbligatori' });
    const updated = await aggiornaDocumentoSicurezza(id, { titolo, categoria, descrizione, versione, data_approvazione: data_approvazione || null, data_scadenza: data_scadenza || null });
    if (!updated) return res.status(404).json({ error: 'Documento non trovato' });
    await logAudit(req.session.user.id, 'doc_sicurezza_aggiornato', `Documento #${id}`, req.ip);
    res.json({ success: true, message: 'Documento aggiornato' });
  } catch (err) {
    console.error('[admin doc sicurezza update]', err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

router.delete('/documenti/:id', requireAuth, requireManager, apiLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID non valido' });
    const deleted = await eliminaDocumentoSicurezza(id);
    if (!deleted) return res.status(404).json({ error: 'Documento non trovato' });
    await logAudit(req.session.user.id, 'doc_sicurezza_eliminato', `Documento #${id}`, req.ip);
    res.json({ success: true, message: 'Documento eliminato' });
  } catch (err) {
    console.error('[admin doc sicurezza delete]', err);
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
