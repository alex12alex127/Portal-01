const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validateFerie } = require('../middleware/validation');
const { apiLimiter } = require('../middleware/security');
const { creaNotifica } = require('../lib/notifiche');
const { getFestivitaAnno } = require('../lib/festivita');

// Upload allegati ferie
const uploadDir = path.join(__dirname, '..', 'uploads', 'ferie');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'))
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

const { soloData } = require('../lib/helpers');
const { calcolaGiorniLavorativi } = require('../lib/festivita');

router.get('/', requireAuth, async (req, res) => {
  try {
    const { stato, anno, tipo } = req.query;
    let query = 'SELECT * FROM ferie WHERE user_id = $1';
    const params = [req.session.user.id];
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
    const anni = await db.query('SELECT DISTINCT EXTRACT(YEAR FROM data_inizio)::int AS y FROM ferie WHERE user_id = $1 ORDER BY y DESC', [req.session.user.id]);
    res.render('ferie/index', {
      title: 'Ferie - Portal-01',
      activePage: 'ferie',
      breadcrumbs: [{ label: 'Panoramica', url: '/dashboard' }, { label: 'Ferie' }],
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
      [req.session.user.id, year]
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
    // Festivita per questo mese
    const festivitaAnno = await getFestivitaAnno(year);
    const festivitaMap = {};
    festivitaAnno.forEach(f => {
      // Per ricorrenti, proietta sull'anno richiesto
      const dataStr = f.ricorrente ? (year + '-' + f.data.slice(5)) : f.data;
      const [fy, fm] = dataStr.split('-').map(Number);
      if (fy === year && fm === month) {
        festivitaMap[dataStr] = f.nome;
      }
    });

    res.json({ year, month, byDate, festivita: festivitaMap });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

router.post('/create', requireAuth, apiLimiter, validateFerie, async (req, res) => {
  const { data_inizio, data_fine, note } = req.body;
  const tipo = req.body.tipo || 'ferie';
  const codice_protocollo = (req.body.codice_protocollo && String(req.body.codice_protocollo).trim()) || null;
  if (tipo === 'malattia' && !codice_protocollo) {
    return res.status(400).json({ error: 'Il codice protocollo del medico è obbligatorio per le richieste di malattia' });
  }
  try {
    const overlap = await db.query(
      `SELECT * FROM ferie WHERE user_id = $1 AND stato != 'rejected'
       AND ( (data_inizio <= $2 AND data_fine >= $2) OR (data_inizio <= $3 AND data_fine >= $3) OR (data_inizio >= $2 AND data_fine <= $3) )`,
      [req.session.user.id, data_inizio, data_fine]
    );
    if (overlap.rows.length > 0) {
      return res.status(400).json({ error: 'Hai già una richiesta per questo periodo' });
    }
    const giorni = await calcolaGiorniLavorativi(data_inizio, data_fine);
    await db.query(
      'INSERT INTO ferie (user_id, data_inizio, data_fine, giorni_totali, tipo, note, codice_protocollo) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.session.user.id, data_inizio, data_fine, giorni, tipo, note || null, tipo === 'malattia' ? codice_protocollo : null]
    );
    
    // Crea notifica per l'utente
    await creaNotifica(
      req.session.user.id,
      'ferie_create',
      'Richiesta ferie inviata',
      `La tua richiesta di ${tipo} dal ${data_inizio} al ${data_fine} è stata inviata ed è in attesa di approvazione.`
    );
    
    // Notifica al responsabile diretto (se assegnato), altrimenti a tutti admin/manager
    const userInfo = await db.query('SELECT responsabile_id FROM users WHERE id = $1', [req.session.user.id]);
    const responsabileId = userInfo.rows[0] ? userInfo.rows[0].responsabile_id : null;
    
    if (responsabileId) {
      await creaNotifica(
        responsabileId,
        'ferie_approve',
        'Nuova richiesta ferie da approvare',
        `${req.session.user.full_name} ha richiesto ${tipo} dal ${data_inizio} al ${data_fine}.`
      );
    }
    // Notifica sempre anche admin
    const adminResult = await db.query(
      'SELECT id FROM users WHERE role = $1 AND is_active = true AND id != $2',
      ['admin', responsabileId || 0]
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
  const codice_protocollo = (req.body.codice_protocollo && String(req.body.codice_protocollo).trim()) || null;
  const tipoVal = ['ferie', 'permesso', 'malattia'].includes(tipo) ? tipo : 'ferie';
  if (tipoVal === 'malattia' && !codice_protocollo) {
    return res.status(400).json({ error: 'Il codice protocollo del medico è obbligatorio per le richieste di malattia' });
  }
  try {
    const check = await db.query('SELECT id FROM ferie WHERE id = $1 AND user_id = $2 AND stato = $3', [id, req.session.user.id, 'pending']);
    if (check.rows.length === 0) return res.status(403).json({ error: 'Richiesta non trovata o non modificabile' });
    const overlap = await db.query(
      `SELECT * FROM ferie WHERE user_id = $1 AND id != $2 AND stato != 'rejected'
       AND ( (data_inizio <= $3 AND data_fine >= $3) OR (data_inizio <= $4 AND data_fine >= $4) OR (data_inizio >= $3 AND data_fine <= $4) )`,
      [req.session.user.id, id, data_inizio, data_fine]
    );
    if (overlap.rows.length > 0) return res.status(400).json({ error: 'Hai già una richiesta per questo periodo' });
    const giorni = await calcolaGiorniLavorativi(data_inizio, data_fine);
    await db.query(
      'UPDATE ferie SET data_inizio = $1, data_fine = $2, giorni_totali = $3, tipo = $4, note = $5, codice_protocollo = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7',
      [data_inizio, data_fine, giorni, tipoVal, note || null, tipoVal === 'malattia' ? codice_protocollo : null, id]
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
    const r = await db.query('UPDATE ferie SET stato = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 AND stato = $4 RETURNING id', ['rejected', id, req.session.user.id, 'pending']);
    if (r.rows.length === 0) return res.status(403).json({ error: 'Richiesta non trovata o non ritirabile' });
    res.json({ success: true, message: 'Richiesta ritirata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

// Upload allegato per richiesta ferie
router.post('/:id/allegato', requireAuth, apiLimiter, upload.single('allegato'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID non valido' });
  if (!req.file) return res.status(400).json({ error: 'File non valido. Formati: PDF, JPG, PNG, DOC. Max 5MB.' });
  try {
    const check = await db.query('SELECT id FROM ferie WHERE id = $1 AND user_id = $2', [id, req.session.user.id]);
    if (check.rows.length === 0) return res.status(403).json({ error: 'Richiesta non trovata' });
    await db.query('UPDATE ferie SET allegato_path = $1, allegato_nome = $2 WHERE id = $3', [req.file.filename, req.file.originalname, id]);
    res.json({ success: true, message: 'Allegato caricato', filename: req.file.originalname });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore upload' });
  }
});

// Download allegato
router.get('/:id/allegato', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).send('ID non valido');
  try {
    const r = await db.query('SELECT allegato_path, allegato_nome, user_id FROM ferie WHERE id = $1', [id]);
    if (r.rows.length === 0 || !r.rows[0].allegato_path) return res.status(404).send('Allegato non trovato');
    const row = r.rows[0];
    // Solo proprietario o admin/manager possono scaricare
    if (row.user_id !== req.session.user.id && !['admin', 'manager'].includes(req.session.user.role)) {
      return res.status(403).send('Accesso negato');
    }
    const filePath = path.join(uploadDir, row.allegato_path);
    if (!fs.existsSync(filePath)) return res.status(404).send('File non trovato');
    res.download(filePath, row.allegato_nome);
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore download');
  }
});

// Calendario condiviso - iCal export
router.get('/calendar/ical', requireAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT f.data_inizio, f.data_fine, f.tipo, u.full_name
      FROM ferie f JOIN users u ON u.id = f.user_id
      WHERE f.stato = 'approved'
      ORDER BY f.data_inizio
    `);
    let ical = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Portal-01//Ferie//IT\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:Ferie Portal-01\r\n';
    result.rows.forEach((r, i) => {
      const dtStart = soloData(r.data_inizio).replace(/-/g, '');
      const dtEndDate = new Date(r.data_fine);
      dtEndDate.setDate(dtEndDate.getDate() + 1);
      const dtEnd = dtEndDate.toISOString().slice(0, 10).replace(/-/g, '');
      const tipoLabel = r.tipo === 'ferie' ? 'Ferie' : r.tipo === 'permesso' ? 'Permesso' : r.tipo === 'malattia' ? 'Malattia' : r.tipo;
      ical += `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${dtStart}\r\nDTEND;VALUE=DATE:${dtEnd}\r\nSUMMARY:${r.full_name} - ${tipoLabel}\r\nUID:ferie-${i}@portal-01\r\nEND:VEVENT\r\n`;
    });
    ical += 'END:VCALENDAR\r\n';
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ferie-portal-01.ics"');
    res.send(ical);
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore export calendario');
  }
});

module.exports = router;
