const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');
const { getAvvisiVisibili, getAvviso, marcaAvvisoComeLetto, contaAvvisiNonLetti } = require('../lib/avvisi');

// GET /avvisi - Pagina principale
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [avvisi, nonLetti] = await Promise.all([
      getAvvisiVisibili(userId),
      contaAvvisiNonLetti(userId)
    ]);
    res.render('avvisi/index', {
      title: 'Avvisi - Portal-01',
      activePage: 'avvisi',
      breadcrumbs: [{ label: 'Panoramica', url: '/dashboard' }, { label: 'Avvisi' }],
      avvisi,
      nonLetti
    });
  } catch (err) {
    console.error('[avvisi]', err);
    res.status(500).send('Errore del server');
  }
});

// GET /avvisi/api - JSON per AJAX
router.get('/api', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [avvisi, nonLetti] = await Promise.all([
      getAvvisiVisibili(userId),
      contaAvvisiNonLetti(userId)
    ]);
    res.json({ success: true, avvisi, nonLetti });
  } catch (err) {
    console.error('[avvisi api]', err);
    res.status(500).json({ success: false, error: 'Errore caricamento avvisi' });
  }
});

// GET /avvisi/:id - Dettaglio avviso
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const avviso = await getAvviso(req.params.id);
    if (!avviso) return res.status(404).send('Avviso non trovato');
    // Marca come letto
    marcaAvvisoComeLetto(req.params.id, req.session.user.id).catch(() => {});
    res.render('avvisi/dettaglio', {
      title: avviso.titolo + ' - Portal-01',
      activePage: 'avvisi',
      breadcrumbs: [{ label: 'Panoramica', url: '/dashboard' }, { label: 'Avvisi', url: '/avvisi' }, { label: avviso.titolo }],
      avviso
    });
  } catch (err) {
    console.error('[avvisi dettaglio]', err);
    res.status(500).send('Errore del server');
  }
});

// POST /avvisi/:id/letta - Marca come letto (AJAX)
router.post('/:id/letta', requireAuth, apiLimiter, async (req, res) => {
  try {
    await marcaAvvisoComeLetto(req.params.id, req.session.user.id);
    const nonLetti = await contaAvvisiNonLetti(req.session.user.id);
    res.json({ success: true, nonLetti });
  } catch (err) {
    console.error('[avvisi letta]', err);
    res.status(500).json({ success: false, error: 'Errore marcatura avviso' });
  }
});

module.exports = router;
