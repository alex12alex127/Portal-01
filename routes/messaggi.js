const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');
const {
  creaConversazione,
  getConversazioniUtente,
  getConversazione,
  getPartecipanti,
  getMessaggi,
  contaMessaggi,
  inviaMessaggio,
  segnaComeLetta,
  contaMessaggiNonLetti,
  archiviaConversazione,
  getUtentiAttivi
} = require('../lib/messaggi');

router.use(requireAuth);

// GET /messaggi - Lista conversazioni
router.get('/', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [conversazioni, utenti, nonLetti] = await Promise.all([
      getConversazioniUtente(userId),
      getUtentiAttivi(userId),
      contaMessaggiNonLetti(userId)
    ]);
    res.render('messaggi/index', {
      title: 'Messaggi - Portal-01',
      activePage: 'messaggi',
      breadcrumbs: [{ label: 'Panoramica', url: '/dashboard' }, { label: 'Messaggi' }],
      conversazioni,
      utenti,
      nonLetti
    });
  } catch (err) {
    console.error('[messaggi]', err);
    res.status(500).send('Errore del server');
  }
});

// GET /messaggi/count - Conteggio non letti (per badge)
router.get('/count', async (req, res) => {
  try {
    const count = await contaMessaggiNonLetti(req.session.user.id);
    res.json({ success: true, count });
  } catch (err) {
    console.error('[messaggi count]', err);
    res.status(500).json({ success: false, error: 'Errore conteggio' });
  }
});

// POST /messaggi/nuova - Crea nuova conversazione
router.post('/nuova', apiLimiter, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { oggetto, destinatari, messaggio } = req.body;

    if (!oggetto || !oggetto.trim()) {
      return res.status(400).json({ success: false, error: 'Oggetto obbligatorio' });
    }

    // destinatari può essere un singolo ID o un array
    let destIds = Array.isArray(destinatari) ? destinatari.map(Number) : [Number(destinatari)];
    destIds = destIds.filter(id => !isNaN(id) && id > 0);

    if (destIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Seleziona almeno un destinatario' });
    }

    const conv = await creaConversazione(userId, oggetto.trim(), destIds, messaggio);

    // Se richiesta AJAX
    const accept = req.headers.accept || '';
    if (accept.indexOf('json') !== -1) {
      return res.json({ success: true, conversazione: conv });
    }

    const bp = req.app.get('basePath') || '';
    res.redirect(bp + '/messaggi/' + conv.id);
  } catch (err) {
    console.error('[messaggi nuova]', err);
    res.status(500).json({ success: false, error: 'Errore creazione conversazione' });
  }
});

// GET /messaggi/:id - Visualizza conversazione
router.get('/:id', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const convId = parseInt(req.params.id, 10);
    if (isNaN(convId)) return res.redirect((req.app.get('basePath') || '') + '/messaggi');

    const conv = await getConversazione(convId, userId);
    if (!conv) {
      return res.status(404).render('404', { title: '404 - Portal-01' });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    const [partecipanti, messaggi, totaleMsgs] = await Promise.all([
      getPartecipanti(convId),
      getMessaggi(convId, limit, offset),
      contaMessaggi(convId)
    ]);

    // Segna come letta
    await segnaComeLetta(convId, userId);

    const totalPages = Math.ceil(totaleMsgs / limit);

    res.render('messaggi/conversazione', {
      title: conv.oggetto + ' - Messaggi - Portal-01',
      activePage: 'messaggi',
      breadcrumbs: [
        { label: 'Panoramica', url: '/dashboard' },
        { label: 'Messaggi', url: '/messaggi' },
        { label: conv.oggetto }
      ],
      conv,
      partecipanti,
      messaggi,
      pagination: { page, limit, total: totaleMsgs, totalPages }
    });
  } catch (err) {
    console.error('[messaggi conv]', err);
    res.status(500).send('Errore del server');
  }
});

// POST /messaggi/:id/invia - Invia messaggio
router.post('/:id/invia', apiLimiter, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const convId = parseInt(req.params.id, 10);
    const { testo } = req.body;

    if (!testo || !testo.trim()) {
      return res.status(400).json({ success: false, error: 'Messaggio vuoto' });
    }

    // Verifica partecipazione
    const conv = await getConversazione(convId, userId);
    if (!conv) {
      return res.status(403).json({ success: false, error: 'Non autorizzato' });
    }

    const msg = await inviaMessaggio(convId, userId, testo);

    const accept = req.headers.accept || '';
    if (accept.indexOf('json') !== -1) {
      return res.json({ success: true, messaggio: msg });
    }

    const bp = req.app.get('basePath') || '';
    res.redirect(bp + '/messaggi/' + convId);
  } catch (err) {
    console.error('[messaggi invia]', err);
    res.status(500).json({ success: false, error: 'Errore invio messaggio' });
  }
});

// POST /messaggi/:id/letto - Segna come letta
router.post('/:id/letto', apiLimiter, async (req, res) => {
  try {
    await segnaComeLetta(parseInt(req.params.id, 10), req.session.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[messaggi letto]', err);
    res.status(500).json({ success: false, error: 'Errore' });
  }
});

// POST /messaggi/:id/archivia - Archivia conversazione (solo creatore)
router.post('/:id/archivia', apiLimiter, async (req, res) => {
  try {
    await archiviaConversazione(parseInt(req.params.id, 10), req.session.user.id, true);
    const accept = req.headers.accept || '';
    if (accept.indexOf('json') !== -1) {
      return res.json({ success: true });
    }
    const bp = req.app.get('basePath') || '';
    res.redirect(bp + '/messaggi');
  } catch (err) {
    console.error('[messaggi archivia]', err);
    const isAuth = err.message && err.message.indexOf('creatore') !== -1;
    const accept = req.headers.accept || '';
    if (accept.indexOf('json') !== -1) {
      return res.status(isAuth ? 403 : 500).json({ success: false, error: err.message || 'Errore archiviazione' });
    }
    const bp = req.app.get('basePath') || '';
    res.redirect(bp + '/messaggi/' + req.params.id);
  }
});

module.exports = router;
