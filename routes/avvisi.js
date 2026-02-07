const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');
const {
  getAvvisiVisibili,
  getAvviso,
  creaAvviso,
  aggiornaAvviso,
  eliminaAvviso,
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

// GET /admin/avvisi - Gestione avvisi (solo admin)
router.get('/admin', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const avvisi = await getAvvisiVisibili();
    
    res.render('admin/avvisi', {
      title: 'Gestione Avvisi - Portal-01',
      activePage: 'admin-avvisi',
      breadcrumbs: [
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'Admin', url: '/admin' },
        { label: 'Avvisi' }
      ],
      avvisi
    });
  } catch (err) {
    console.error('[admin avvisi]', err);
    res.status(500).send('Errore del server');
  }
});

// POST /admin/avvisi - Crea nuovo avviso (solo admin)
router.post('/admin', requireAuth, requireRole('admin'), apiLimiter, async (req, res) => {
  try {
    const { titolo, contenuto, tipo, in_evidenza, visibile_da, visibile_fino } = req.body;
    
    if (!titolo || !contenuto) {
      return res.status(400).json({ error: 'Titolo e contenuto sono obbligatori' });
    }
    
    const avviso = await creaAvviso(titolo, contenuto, tipo || 'info', {
      in_evidenza: in_evidenza === 'on',
      visibile_da: visibile_da || null,
      visibile_fino: visibile_fino || null,
      created_by: req.session.user.id
    });
    
    res.json({ success: true, avviso });
  } catch (err) {
    console.error('[admin avviso create]', err);
    res.status(500).json({ error: 'Errore creazione avviso' });
  }
});

// PUT /admin/avvisi/:id - Aggiorna avviso (solo admin)
router.put('/admin/:id', requireAuth, requireRole('admin'), apiLimiter, async (req, res) => {
  try {
    const { titolo, contenuto, tipo, in_evidenza, visibile_da, visibile_fino } = req.body;
    
    if (!titolo || !contenuto) {
      return res.status(400).json({ error: 'Titolo e contenuto sono obbligatori' });
    }
    
    const avviso = await aggiornaAvviso(req.params.id, {
      titolo,
      contenuto,
      tipo: tipo || 'info',
      in_evidenza: in_evidenza === 'on',
      visibile_da: visibile_da || null,
      visibile_fino: visibile_fino || null
    });
    
    res.json({ success: true, avviso });
  } catch (err) {
    console.error('[admin avviso update]', err);
    res.status(500).json({ error: 'Errore aggiornamento avviso' });
  }
});

// DELETE /admin/avvisi/:id - Elimina avviso (solo admin)
router.delete('/admin/:id', requireAuth, requireRole('admin'), apiLimiter, async (req, res) => {
  try {
    await eliminaAvviso(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[admin avviso delete]', err);
    res.status(500).json({ error: 'Errore eliminazione avviso' });
  }
});

module.exports = router;
