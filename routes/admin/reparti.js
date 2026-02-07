const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../lib/permissions');
const { apiLimiter } = require('../../middleware/security');
const { logAudit } = require('../../lib/audit');
const db = require('../../config/database');
const { getAllReparti, creaReparto, aggiornaReparto, eliminaReparto } = require('../../lib/reparti');

router.get('/', requireAuth, requirePermission('reparti.view'), async (req, res) => {
  try {
    const reparti = await getAllReparti();
    // Conta dipendenti per reparto
    const counts = await db.query(
      `SELECT reparto_id, COUNT(*)::int AS n FROM users WHERE reparto_id IS NOT NULL AND is_active = true GROUP BY reparto_id`
    );
    const countMap = {};
    counts.rows.forEach(r => { countMap[r.reparto_id] = r.n; });
    reparti.forEach(r => { r.num_dipendenti = countMap[r.id] || 0; });

    const usersList = await db.query('SELECT id, full_name, username FROM users WHERE is_active = true ORDER BY full_name');
    res.render('admin/reparti', {
      title: 'Reparti - Portal-01',
      activePage: 'adminReparti',
      breadcrumbs: [{ label: 'Panoramica', url: '/dashboard' }, { label: 'Reparti' }],
      reparti,
      usersList: usersList.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

router.post('/', requireAuth, requirePermission('reparti.edit'), apiLimiter, async (req, res) => {
  const { nome, descrizione, responsabile_id } = req.body;
  if (!nome || !String(nome).trim()) return res.status(400).json({ error: 'Nome reparto obbligatorio' });
  try {
    await creaReparto(String(nome).trim(), descrizione, responsabile_id || null);
    await logAudit(req.session.user.id, 'reparto_creato', `nome=${nome}`, req.ip);
    res.json({ success: true, message: 'Reparto creato' });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Esiste già un reparto con questo nome' });
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.put('/:id', requireAuth, requirePermission('reparti.edit'), apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID non valido' });
  const { nome, descrizione, responsabile_id } = req.body;
  if (!nome || !String(nome).trim()) return res.status(400).json({ error: 'Nome obbligatorio' });
  try {
    const r = await aggiornaReparto(id, String(nome).trim(), descrizione, responsabile_id || null);
    if (!r) return res.status(404).json({ error: 'Reparto non trovato' });
    await logAudit(req.session.user.id, 'reparto_aggiornato', `id=${id} nome=${nome}`, req.ip);
    res.json({ success: true, message: 'Reparto aggiornato' });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Nome già esistente' });
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.delete('/:id', requireAuth, requirePermission('reparti.edit'), apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID non valido' });
  try {
    const r = await eliminaReparto(id);
    if (!r) return res.status(404).json({ error: 'Reparto non trovato' });
    await logAudit(req.session.user.id, 'reparto_eliminato', `id=${id}`, req.ip);
    res.json({ success: true, message: 'Reparto eliminato' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

module.exports = router;
