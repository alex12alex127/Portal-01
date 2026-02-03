const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Middleware per verificare autenticazione
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }
  next();
};

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM ferie WHERE user_id = $1 ORDER BY data_inizio DESC',
      [req.session.userId]
    );
    res.render('ferie/index', { ferie: result.rows, user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

router.post('/create', requireAuth, async (req, res) => {
  const { data_inizio, data_fine, tipo, note } = req.body;
  
  try {
    const giorni = Math.ceil((new Date(data_fine) - new Date(data_inizio)) / (1000 * 60 * 60 * 24)) + 1;
    
    await db.query(
      'INSERT INTO ferie (user_id, data_inizio, data_fine, giorni_totali, tipo, note) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.session.userId, data_inizio, data_fine, giorni, tipo, note]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore durante la creazione' });
  }
});

router.get('/api/list', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM ferie WHERE user_id = $1 ORDER BY data_inizio DESC',
      [req.session.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

module.exports = router;
