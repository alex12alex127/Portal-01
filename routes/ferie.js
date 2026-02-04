const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateFerie } = require('../middleware/validation');
const { apiLimiter } = require('../middleware/security');

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM ferie WHERE user_id = $1 ORDER BY data_inizio DESC', [req.session.userId]);
    res.render('ferie/index', { title: 'Ferie - Portal-01', activePage: 'ferie', ferie: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

router.post('/create', requireAuth, apiLimiter, validateFerie, async (req, res) => {
  const { data_inizio, data_fine, note } = req.body;
  const tipo = req.body.tipo || 'ferie';
  try {
    const overlap = await db.query(
      `SELECT * FROM ferie WHERE user_id = $1 AND stato != 'rejected'
       AND ( (data_inizio <= $2 AND data_fine >= $2) OR (data_inizio <= $3 AND data_fine >= $3) OR (data_inizio >= $2 AND data_fine <= $3) )`,
      [req.session.userId, data_inizio, data_fine]
    );
    if (overlap.rows.length > 0) {
      return res.status(400).json({ error: 'Hai già una richiesta per questo periodo' });
    }
    const giorni = Math.ceil((new Date(data_fine) - new Date(data_inizio)) / (1000 * 60 * 60 * 24)) + 1;
    await db.query(
      'INSERT INTO ferie (user_id, data_inizio, data_fine, giorni_totali, tipo, note) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.session.userId, data_inizio, data_fine, giorni, tipo, note || null]
    );
    res.json({ success: true, message: 'Richiesta inviata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore durante la creazione' });
  }
});

module.exports = router;
