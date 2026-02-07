const express = require('express');
const router = express.Router();
const { requireAuth, requireManager } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/security');
const { logAudit } = require('../../lib/audit');
const {
  getAllFestivita,
  creaFestivita,
  aggiornaFestivita,
  eliminaFestivita,
  inserisciFestivitaItaliane
} = require('../../lib/festivita');

// Lista festività
router.get('/', requireAuth, requireManager, async (req, res) => {
  try {
    const festivita = await getAllFestivita();
    res.render('admin/festivita', {
      title: 'Festività Aziendali - Portal-01',
      activePage: 'adminFestivita',
      breadcrumbs: [{ label: 'Panoramica', url: '/dashboard' }, { label: 'Festività Aziendali' }],
      festivita
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

// Crea festività
router.post('/', requireAuth, requireManager, apiLimiter, async (req, res) => {
  const { nome, data, ricorrente, note } = req.body;
  if (!nome || !data) return res.status(400).json({ error: 'Nome e data sono obbligatori' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return res.status(400).json({ error: 'Formato data non valido (YYYY-MM-DD)' });
  try {
    await creaFestivita({
      nome: String(nome).trim(),
      data,
      ricorrente: ricorrente === true || ricorrente === 'true' || ricorrente === 'on',
      note: note ? String(note).trim() : null,
      created_by: req.session.user.id
    });
    await logAudit(req.session.user.id, 'festivita_creata', `nome=${nome} data=${data} ricorrente=${!!ricorrente}`, req.ip);
    res.json({ success: true, message: 'Festività creata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore durante la creazione' });
  }
});

// Aggiorna festività
router.put('/:id', requireAuth, requireManager, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID non valido' });
  const { nome, data, ricorrente, note } = req.body;
  if (!nome || !data) return res.status(400).json({ error: 'Nome e data sono obbligatori' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return res.status(400).json({ error: 'Formato data non valido' });
  try {
    const r = await aggiornaFestivita(id, {
      nome: String(nome).trim(),
      data,
      ricorrente: ricorrente === true || ricorrente === 'true' || ricorrente === 'on',
      note: note ? String(note).trim() : null
    });
    if (!r) return res.status(404).json({ error: 'Festività non trovata' });
    await logAudit(req.session.user.id, 'festivita_aggiornata', `id=${id} nome=${nome}`, req.ip);
    res.json({ success: true, message: 'Festività aggiornata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento' });
  }
});

// Elimina festività
router.delete('/:id', requireAuth, requireManager, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID non valido' });
  try {
    const r = await eliminaFestivita(id);
    if (!r) return res.status(404).json({ error: 'Festività non trovata' });
    await logAudit(req.session.user.id, 'festivita_eliminata', `id=${id}`, req.ip);
    res.json({ success: true, message: 'Festività eliminata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore durante l\'eliminazione' });
  }
});

// Inserisci festività italiane standard
router.post('/italiane', requireAuth, requireManager, apiLimiter, async (req, res) => {
  const anno = parseInt(req.body.anno, 10) || new Date().getFullYear();
  try {
    const inserite = await inserisciFestivitaItaliane(anno, req.session.user.id);
    await logAudit(req.session.user.id, 'festivita_italiane_inserite', `anno=${anno} inserite=${inserite.length}`, req.ip);
    res.json({ success: true, message: `${inserite.length} festività italiane inserite`, count: inserite.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore durante l\'inserimento' });
  }
});

// API: festività per un anno (usato dal calendario ferie)
router.get('/api/anno/:anno', requireAuth, requireManager, async (req, res) => {
  const anno = parseInt(req.params.anno, 10);
  if (Number.isNaN(anno) || anno < 2000 || anno > 2100) return res.status(400).json({ error: 'Anno non valido' });
  try {
    const { getFestivitaAnno } = require('../../lib/festivita');
    const festivita = await getFestivitaAnno(anno);
    // Per le ricorrenti, proietta sull'anno richiesto
    const result = festivita.map(f => ({
      id: f.id,
      nome: f.nome,
      data: f.ricorrente ? anno + '-' + f.data.slice(5) : f.data,
      ricorrente: f.ricorrente
    }));
    res.json({ anno, festivita: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

module.exports = router;
