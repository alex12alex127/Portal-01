const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');
const { timbraEntrata, timbraUscita, getPresenzaOggi, getRiepilogoMese } = require('../lib/presenze');
const { getSaldoFerie } = require('../lib/budget_ferie');

// Pagina presenze utente
router.get('/', requireAuth, async (req, res) => {
  const anno = parseInt(req.query.anno, 10) || new Date().getFullYear();
  const mese = parseInt(req.query.mese, 10) || new Date().getMonth() + 1;
  try {
    const oggi = await getPresenzaOggi(req.session.user.id);
    const riepilogo = await getRiepilogoMese(req.session.user.id, anno, mese);
    res.render('presenze/index', {
      title: 'Presenze - Portal-01',
      activePage: 'presenze',
      breadcrumbs: [{ label: 'Panoramica', url: '/dashboard' }, { label: 'Presenze' }],
      oggi,
      riepilogo,
      anno,
      mese
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

// Timbra entrata
router.post('/entrata', requireAuth, apiLimiter, async (req, res) => {
  try {
    const result = await timbraEntrata(req.session.user.id, req.body.note);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

// Timbra uscita
router.post('/uscita', requireAuth, apiLimiter, async (req, res) => {
  try {
    const result = await timbraUscita(req.session.user.id, req.body.note);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

// API: presenza di oggi
router.get('/oggi', requireAuth, async (req, res) => {
  try {
    const oggi = await getPresenzaOggi(req.session.user.id);
    res.json({ success: true, presenza: oggi });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

module.exports = router;
