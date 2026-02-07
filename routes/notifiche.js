const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { 
  getNotificheUtente, 
  contaNotificheNonLette, 
  marcaNotificaComeLetta, 
  marcaTutteComeLette,
  eliminaNotifica
} = require('../lib/notifiche');

const router = express.Router();

// Middleware per autenticazione su tutte le route
router.use(requireAuth);

// GET /notifiche - Lista notifiche utente (pagina HTML)
router.get('/', async (req, res) => {
  try {
    const notifiche = await getNotificheUtente(req.session.user.id, 20);
    const nonLette = await contaNotificheNonLette(req.session.user.id);
    
    res.render('notifiche/index', {
      title: 'Notifiche - Portal-01',
      activePage: 'notifiche',
      breadcrumbs: [{ label: 'Dashboard', url: '/dashboard' }, { label: 'Notifiche' }],
      notifiche,
      nonLette
    });
  } catch (err) {
    console.error('[notifiche]', err);
    res.status(500).send('Errore caricamento notifiche');
  }
});

// GET /notifiche/api - Lista notifiche utente (JSON per AJAX)
router.get('/api', async (req, res) => {
  try {
    const notifiche = await getNotificheUtente(req.session.user.id, 20);
    const nonLette = await contaNotificheNonLette(req.session.user.id);
    
    res.json({
      success: true,
      notifiche,
      nonLette
    });
  } catch (err) {
    console.error('[notifiche]', err);
    res.status(500).json({ error: 'Errore caricamento notifiche' });
  }
});

// GET /notifiche/count - Conteggio notifiche non lette
router.get('/count', async (req, res) => {
  try {
    const count = await contaNotificheNonLette(req.session.user.id);
    res.json({ success: true, count });
  } catch (err) {
    console.error('[notifiche count]', err);
    res.status(500).json({ error: 'Errore conteggio notifiche' });
  }
});

// POST /notifiche/:id/read - Marca notifica come letta
router.post('/:id/read', async (req, res) => {
  try {
    await marcaNotificaComeLetta(req.params.id, req.session.user.id);
    const count = await contaNotificheNonLette(req.session.user.id);
    res.json({ success: true, nonLette: count });
  } catch (err) {
    console.error('[notifiche read]', err);
    res.status(500).json({ error: 'Errore marcatura notifica' });
  }
});

// POST /notifiche/read-all - Marca tutte come lette
router.post('/read-all', async (req, res) => {
  try {
    await marcaTutteComeLette(req.session.user.id);
    res.json({ success: true, nonLette: 0 });
  } catch (err) {
    console.error('[notifiche read all]', err);
    res.status(500).json({ error: 'Errore marcatura notifiche' });
  }
});

// DELETE /notifiche/:id - Elimina notifica
router.delete('/:id', async (req, res) => {
  try {
    await eliminaNotifica(req.params.id, req.session.user.id);
    const count = await contaNotificheNonLette(req.session.user.id);
    res.json({ success: true, nonLette: count });
  } catch (err) {
    console.error('[notifiche delete]', err);
    res.status(500).json({ error: 'Errore eliminazione notifica' });
  }
});

module.exports = router;
