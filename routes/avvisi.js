const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');
const {
  getAvvisiVisibili,
  getAvviso,
  marcaAvvisoComeLetto,
  contaAvvisiNonLetti
} = require('../lib/avvisi');

// GET /avvisi - Lista avvisi visibili (per tutti gli utenti autenticati)
router.get('/', requireAuth, async (req, res) => {
  try {
    const avvisi = await getAvvisiVisibili(req.session.user.id);
    const nonLetti = await contaAvvisiNonLetti(req.session.user.id);
    
    res.render('avvisi/index', {
      title: 'Avvisi - Portal-01',
      activePage: 'avvisi',
      breadcrumbs: [{ label: 'Dashboard', url: '/dashboard' }, { label: 'Avvisi' }],
      avvisi,
      nonLetti,
      isAdmin: req.session.user.role === 'admin'
    });
  } catch (err) {
    console.error('[avvisi]', err);
    res.status(500).send('Errore del server');
  }
});

// GET /avvisi/:id - Dettaglio avviso
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const avviso = await getAvviso(req.params.id);
    if (!avviso) {
      return res.status(404).send('Avviso non trovato');
    }
    
    // Marca come letto
    await marcaAvvisoComeLetto(req.params.id, req.session.user.id);
    
    res.render('avvisi/dettaglio', {
      title: avviso.titolo + ' - Portal-01',
      activePage: 'avvisi',
      breadcrumbs: [
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'Avvisi', url: '/avvisi' },
        { label: avviso.titolo }
      ],
      avviso
    });
  } catch (err) {
    console.error('[avviso dettaglio]', err);
    res.status(500).send('Errore del server');
  }
});

// POST /avvisi/:id/letta - Marca avviso come letto (AJAX)
router.post('/:id/letta', requireAuth, apiLimiter, async (req, res) => {
  try {
    await marcaAvvisoComeLetto(req.params.id, req.session.user.id);
    const nonLetti = await contaAvvisiNonLetti(req.session.user.id);
    res.json({ success: true, nonLetti });
  } catch (err) {
    console.error('[avviso letto]', err);
    res.status(500).json({ error: 'Errore' });
  }
});

module.exports = router;
