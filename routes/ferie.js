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

// Calendario: chi è in ferie (approvate) per ogni giorno del mese — tutti i dipendenti
router.get('/calendar', requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
    if (month < 1 || month > 12) return res.status(400).json({ error: 'Mese non valido' });
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const start = firstDay.toISOString().slice(0, 10);
    const end = lastDay.toISOString().slice(0, 10);
    const result = await db.query(`
      SELECT f.data_inizio, f.data_fine, u.full_name, u.username
      FROM ferie f
      JOIN users u ON u.id = f.user_id
      WHERE f.stato = 'approved'
        AND f.data_inizio <= $1 AND f.data_fine >= $2
    `, [end, start]);
    const byDate = {};
    for (const row of result.rows) {
      const [sy, sm, sd] = row.data_inizio.split('-').map(Number);
      const [ey, em, ed] = row.data_fine.split('-').map(Number);
      const dStart = new Date(sy, sm - 1, sd);
      const dEnd = new Date(ey, em - 1, ed);
      for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push({ full_name: row.full_name, username: row.username });
      }
    }
    res.json({ year, month, byDate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore del server' });
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
