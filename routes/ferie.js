const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateFerie } = require('../middleware/validation');
const { apiLimiter } = require('../middleware/security');
const { creaNotifica } = require('../lib/notifiche');

function soloData (val) {
  if (val == null) return '';
  if (typeof val === 'string') return val.slice(0, 10);
  if (typeof val.toISOString === 'function') return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const { stato, anno, tipo } = req.query;
    let query = 'SELECT * FROM ferie WHERE user_id = $1';
    const params = [req.session.userId];
    let n = 2;
    if (stato && ['pending', 'approved', 'rejected'].includes(stato)) {
      query += ` AND stato = $${n}`;
      params.push(stato);
      n++;
    }
    if (anno && /^\d{4}$/.test(anno)) {
      query += ` AND EXTRACT(YEAR FROM data_inizio) = $${n}`;
      params.push(parseInt(anno, 10));
      n++;
    }
    if (tipo && ['ferie', 'permesso', 'malattia'].includes(tipo)) {
      query += ` AND tipo = $${n}`;
      params.push(tipo);
      n++;
    }
    query += ' ORDER BY data_inizio DESC';
    const result = await db.query(query, params);
    const ferie = result.rows.map(r => ({
      ...r,
      data_inizio: soloData(r.data_inizio),
      data_fine: soloData(r.data_fine)
    }));
    const anni = await db.query('SELECT DISTINCT EXTRACT(YEAR FROM data_inizio)::int AS y FROM ferie WHERE user_id = $1 ORDER BY y DESC', [req.session.userId]);
    res.render('ferie/index', {
      title: 'Ferie - Portal-01',
      activePage: 'ferie',
      breadcrumbs: [{ label: 'Dashboard', url: '/dashboard' }, { label: 'Ferie' }],
      ferie,
      filtri: { stato: stato || '', anno: anno || '', tipo: tipo || '' },
      anni: anni.rows.map(r => r.y)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

router.get('/summary', requireAuth, async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const r = await db.query(
      `SELECT stato, COUNT(*)::int AS n, COALESCE(SUM(giorni_totali), 0)::int AS giorni FROM ferie WHERE user_id = $1 AND EXTRACT(YEAR FROM data_inizio) = $2 GROUP BY stato`,
      [req.session.userId, year]
    );
    const summary = { pending: 0, approved: 0, rejected: 0, giorniPending: 0, giorniApproved: 0, giorniRejected: 0 };
    r.rows.forEach(row => {
      summary[row.stato] = row.n;
      summary['giorni' + row.stato.charAt(0).toUpperCase() + row.stato.slice(1)] = row.giorni;
    });
    res.json({ year, ...summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
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
      const startStr = typeof row.data_inizio === 'string' ? row.data_inizio : row.data_inizio.toISOString().slice(0, 10);
      const endStr = typeof row.data_fine === 'string' ? row.data_fine : row.data_fine.toISOString().slice(0, 10);
      const [sy, sm, sd] = startStr.split('-').map(Number);
      const [ey, em, ed] = endStr.split('-').map(Number);
      const dStart = new Date(sy, sm - 1, sd);
      const dEnd = new Date(ey, em - 1, ed);
      for (let d = new Date(dStart.getTime()); d.getTime() <= dEnd.getTime(); d.setDate(d.getDate() + 1)) {
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
    
    // Crea notifica per l'utente
    await creaNotifica(
      req.session.userId,
      'ferie_create',
      'Richiesta ferie inviata',
      `La tua richiesta di ${tipo} dal ${data_inizio} al ${data_fine} è stata inviata ed è in attesa di approvazione.`
    );
    
    // Crea notifiche per admin/manager
    const adminResult = await db.query(
      'SELECT id FROM users WHERE role IN ($1, $2) AND is_active = true',
      ['admin', 'manager']
    );
    
    for (const admin of adminResult.rows) {
      await creaNotifica(
        admin.id,
        'ferie_approve',
        'Nuova richiesta ferie da approvare',
        `${req.session.user.full_name} ha richiesto ${tipo} dal ${data_inizio} al ${data_fine}.`
      );
    }
    
    res.json({ success: true, message: 'Richiesta inviata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore durante la creazione' });
  }
});

router.put('/:id', requireAuth, apiLimiter, validateFerie, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID non valido' });
  const { data_inizio, data_fine, tipo, note } = req.body;
  try {
    const check = await db.query('SELECT id FROM ferie WHERE id = $1 AND user_id = $2 AND stato = $3', [id, req.session.userId, 'pending']);
    if (check.rows.length === 0) return res.status(403).json({ error: 'Richiesta non trovata o non modificabile' });
    const overlap = await db.query(
      `SELECT * FROM ferie WHERE user_id = $1 AND id != $2 AND stato != 'rejected'
       AND ( (data_inizio <= $3 AND data_fine >= $3) OR (data_inizio <= $4 AND data_fine >= $4) OR (data_inizio >= $3 AND data_fine <= $4) )`,
      [req.session.userId, id, data_inizio, data_fine]
    );
    if (overlap.rows.length > 0) return res.status(400).json({ error: 'Hai già una richiesta per questo periodo' });
    const tipoVal = ['ferie', 'permesso', 'malattia'].includes(tipo) ? tipo : 'ferie';
    const giorni = Math.ceil((new Date(data_fine) - new Date(data_inizio)) / (1000 * 60 * 60 * 24)) + 1;
    await db.query(
      'UPDATE ferie SET data_inizio = $1, data_fine = $2, giorni_totali = $3, tipo = $4, note = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6',
      [data_inizio, data_fine, giorni, tipoVal, note || null, id]
    );
    res.json({ success: true, message: 'Richiesta aggiornata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.post('/:id/withdraw', requireAuth, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID non valido' });
  try {
    const r = await db.query('UPDATE ferie SET stato = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 AND stato = $4 RETURNING id', ['rejected', id, req.session.userId, 'pending']);
    if (r.rows.length === 0) return res.status(403).json({ error: 'Richiesta non trovata o non ritirabile' });
    res.json({ success: true, message: 'Richiesta ritirata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

module.exports = router;
