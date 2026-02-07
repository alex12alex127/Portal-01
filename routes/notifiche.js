const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');
const {
  getNotificheUtente,
  contaNotificheNonLette,
  marcaNotificaComeLetta,
  marcaTutteComeLette,
  eliminaNotifica,
  eliminaTutteNotifiche
} = require('../lib/notifiche');

router.use(requireAuth);

// GET /notifiche - Pagina principale
router.get('/', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [notifiche, nonLette] = await Promise.all([
      getNotificheUtente(userId, 50),
      contaNotificheNonLette(userId)
    ]);
    res.render('notifiche/index', {
      title: 'Notifiche - Portal-01',
      activePage: 'notifiche',
      breadcrumbs: [{ label: 'Panoramica', url: '/dashboard' }, { label: 'Notifiche' }],
      notifiche,
      nonLette
    });
  } catch (err) {
    console.error('[notifiche]', err);
    res.status(500).send('Errore del server');
  }
});

// GET /notifiche/api - JSON per AJAX
router.get('/api', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [notifiche, nonLette] = await Promise.all([
      getNotificheUtente(userId, 50),
      contaNotificheNonLette(userId)
    ]);
    res.json({ success: true, notifiche, nonLette });
  } catch (err) {
    console.error('[notifiche api]', err);
    res.status(500).json({ success: false, error: 'Errore caricamento notifiche' });
  }
});

// GET /notifiche/count
router.get('/count', async (req, res) => {
  try {
    const count = await contaNotificheNonLette(req.session.user.id);
    res.json({ success: true, count });
  } catch (err) {
    console.error('[notifiche count]', err);
    res.status(500).json({ success: false, error: 'Errore conteggio' });
  }
});

// POST /notifiche/:id/read - Marca singola come letta
router.post('/:id/read', apiLimiter, async (req, res) => {
  try {
    await marcaNotificaComeLetta(req.params.id, req.session.user.id);
    const nonLette = await contaNotificheNonLette(req.session.user.id);
    res.json({ success: true, nonLette });
  } catch (err) {
    console.error('[notifiche read]', err);
    res.status(500).json({ success: false, error: 'Errore marcatura notifica' });
  }
});

// POST /notifiche/read-all - Marca tutte come lette
router.post('/read-all', apiLimiter, async (req, res) => {
  try {
    const updatedCount = await marcaTutteComeLette(req.session.user.id);
    res.json({ success: true, nonLette: 0, updatedCount });
  } catch (err) {
    console.error('[notifiche read-all]', err);
    res.status(500).json({ success: false, error: 'Errore marcatura notifiche' });
  }
});

// DELETE /notifiche/delete-all - Elimina tutte (PRIMA di /:id per evitare conflitto)
router.delete('/delete-all', apiLimiter, async (req, res) => {
  try {
    const deletedCount = await eliminaTutteNotifiche(req.session.user.id);
    res.json({ success: true, nonLette: 0, deletedCount });
  } catch (err) {
    console.error('[notifiche delete-all]', err);
    res.status(500).json({ success: false, error: 'Errore eliminazione notifiche' });
  }
});

// DELETE /notifiche/:id - Elimina singola
router.delete('/:id', apiLimiter, async (req, res) => {
  try {
    await eliminaNotifica(req.params.id, req.session.user.id);
    const nonLette = await contaNotificheNonLette(req.session.user.id);
    res.json({ success: true, nonLette });
  } catch (err) {
    console.error('[notifiche delete]', err);
    res.status(500).json({ success: false, error: 'Errore eliminazione notifica' });
  }
});

module.exports = router;
