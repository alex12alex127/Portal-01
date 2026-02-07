const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/security');
const { logAudit } = require('../../lib/audit');
const {
  getAvviso,
  creaAvviso,
  aggiornaAvviso
} = require('../../lib/avvisi');

router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT a.*, u.full_name as autore_nome
      FROM avvisi a
      LEFT JOIN users u ON a.created_by = u.id
      ORDER BY a.in_evidenza DESC, a.created_at DESC
    `);
    res.render('admin/avvisi', {
      title: 'Gestione Avvisi - Portal-01',
      activePage: 'adminAvvisi',
      breadcrumbs: [{ label: 'Panoramica', url: '/dashboard' }, { label: 'Amministrazione', url: '/admin' }, { label: 'Gestione Avvisi' }],
      avvisi: result.rows
    });
  } catch (err) {
    console.error('[admin avvisi]', err);
    res.status(500).send('Errore del server');
  }
});

router.get('/api', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT a.*, u.full_name as autore_nome
      FROM avvisi a
      LEFT JOIN users u ON a.created_by = u.id
      ORDER BY a.in_evidenza DESC, a.created_at DESC
    `);
    res.json({ success: true, avvisi: result.rows });
  } catch (err) {
    console.error('[admin avvisi api]', err);
    res.status(500).json({ success: false, error: 'Errore caricamento avvisi' });
  }
});

router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const avviso = await getAvviso(req.params.id);
    if (!avviso) return res.status(404).json({ success: false, error: 'Avviso non trovato' });
    avviso.visibile_da = avviso.visibile_da ? String(avviso.visibile_da).slice(0, 10) : '';
    avviso.visibile_fino = avviso.visibile_fino ? String(avviso.visibile_fino).slice(0, 10) : '';
    res.json({ success: true, avviso });
  } catch (err) {
    console.error('[admin avviso get]', err);
    res.status(500).json({ success: false, error: 'Errore caricamento avviso' });
  }
});

router.post('/', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  try {
    const { titolo, contenuto, tipo, in_evidenza, visibile_da, visibile_fino } = req.body || {};
    if (!titolo || !String(titolo).trim()) return res.status(400).json({ success: false, error: 'Titolo obbligatorio' });
    if (!contenuto || !String(contenuto).trim()) return res.status(400).json({ success: false, error: 'Contenuto obbligatorio' });
    const evidenza = in_evidenza === 'on' || in_evidenza === '1' || in_evidenza === true;
    const vDa = (visibile_da && String(visibile_da).trim()) ? String(visibile_da).trim() : null;
    const vFino = (visibile_fino && String(visibile_fino).trim()) ? String(visibile_fino).trim() : null;
    const avviso = await creaAvviso(
      String(titolo).trim(),
      String(contenuto).trim(),
      tipo || 'info',
      { in_evidenza: evidenza, visibile_da: vDa, visibile_fino: vFino, created_by: req.session.user.id }
    );
    await logAudit(req.session.user.id, 'avviso_creato', `titolo=${String(titolo).trim().slice(0, 50)}`, req.ip);
    res.json({ success: true, avviso });
  } catch (err) {
    console.error('[admin avviso create]', err);
    res.status(500).json({ success: false, error: 'Errore creazione avviso' });
  }
});

router.put('/:id', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  try {
    const { titolo, contenuto, tipo, in_evidenza, visibile_da, visibile_fino } = req.body || {};
    if (!titolo || !String(titolo).trim()) return res.status(400).json({ success: false, error: 'Titolo obbligatorio' });
    if (!contenuto || !String(contenuto).trim()) return res.status(400).json({ success: false, error: 'Contenuto obbligatorio' });
    const evidenza = in_evidenza === 'on' || in_evidenza === '1' || in_evidenza === true;
    const vDa = (visibile_da && String(visibile_da).trim()) ? String(visibile_da).trim() : null;
    const vFino = (visibile_fino && String(visibile_fino).trim()) ? String(visibile_fino).trim() : null;
    const avviso = await aggiornaAvviso(req.params.id, {
      titolo: String(titolo).trim(),
      contenuto: String(contenuto).trim(),
      tipo: tipo || 'info',
      in_evidenza: evidenza,
      visibile_da: vDa,
      visibile_fino: vFino
    });
    await logAudit(req.session.user.id, 'avviso_aggiornato', `id=${req.params.id}`, req.ip);
    res.json({ success: true, avviso });
  } catch (err) {
    console.error('[admin avviso update]', err);
    res.status(500).json({ success: false, error: 'Errore aggiornamento avviso' });
  }
});

router.delete('/:id', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ success: false, error: 'ID non valido' });
  try {
    const r = await db.query('DELETE FROM avvisi WHERE id = $1 RETURNING id', [id]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, error: 'Avviso non trovato' });
    await logAudit(req.session.user.id, 'avviso_eliminato', `id=${id}`, req.ip);
    res.json({ success: true, message: 'Avviso eliminato' });
  } catch (err) {
    console.error('[admin avviso delete]', err);
    res.status(500).json({ success: false, error: 'Errore' });
  }
});

module.exports = router;
