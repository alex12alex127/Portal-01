const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../lib/permissions');
const { apiLimiter } = require('../../middleware/security');
const { logAudit } = require('../../lib/audit');
const { getRiepilogoTuttiMese, getPresenzeGiorno, setPresenzaManuale } = require('../../lib/presenze');
const db = require('../../config/database');

router.get('/', requireAuth, requirePermission('presenze.view_all'), async (req, res) => {
  const anno = parseInt(req.query.anno, 10) || new Date().getFullYear();
  const mese = parseInt(req.query.mese, 10) || new Date().getMonth() + 1;
  try {
    const riepilogo = await getRiepilogoTuttiMese(anno, mese);
    const usersList = await db.query('SELECT id, full_name, username FROM users WHERE is_active = true ORDER BY full_name');
    res.render('admin/presenze', {
      title: 'Presenze - Portal-01',
      activePage: 'adminPresenze',
      breadcrumbs: [{ label: 'Panoramica', url: '/dashboard' }, { label: 'Presenze' }],
      riepilogo,
      anno,
      mese,
      usersList: usersList.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

// Presenze di un giorno specifico
router.get('/giorno/:data', requireAuth, requirePermission('presenze.view_all'), async (req, res) => {
  try {
    const presenze = await getPresenzeGiorno(req.params.data);
    res.json({ success: true, presenze });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

// Inserimento/modifica manuale
router.post('/manuale', requireAuth, requirePermission('presenze.edit'), apiLimiter, async (req, res) => {
  const { user_id, data, ora_entrata, ora_uscita, tipo, note } = req.body;
  if (!user_id || !data) return res.status(400).json({ error: 'Utente e data obbligatori' });
  try {
    await setPresenzaManuale(user_id, data, ora_entrata, ora_uscita, tipo, note);
    await logAudit(req.session.user.id, 'presenza_manuale', `user=${user_id} data=${data}`, req.ip);
    res.json({ success: true, message: 'Presenza registrata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

// Export CSV presenze mese
router.get('/export', requireAuth, requirePermission('presenze.export'), async (req, res) => {
  const anno = parseInt(req.query.anno, 10) || new Date().getFullYear();
  const mese = parseInt(req.query.mese, 10) || new Date().getMonth() + 1;
  try {
    const r = await db.query(
      `SELECT u.full_name, u.matricola, r.nome AS reparto, p.data, p.ora_entrata, p.ora_uscita, p.ore_lavorate, p.ore_straordinario, p.tipo, p.note
       FROM presenze p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN reparti r ON r.id = u.reparto_id
       WHERE EXTRACT(YEAR FROM p.data) = $1 AND EXTRACT(MONTH FROM p.data) = $2
       ORDER BY u.full_name, p.data`,
      [anno, mese]
    );
    const mesi = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
    let csv = 'Dipendente;Matricola;Reparto;Data;Entrata;Uscita;Ore Lavorate;Ore Straordinario;Tipo;Note\n';
    r.rows.forEach(row => {
      const data = typeof row.data === 'string' ? row.data.slice(0, 10) : row.data.toISOString().slice(0, 10);
      csv += `${row.full_name};${row.matricola || ''};${row.reparto || ''};${data};${row.ora_entrata || ''};${row.ora_uscita || ''};${row.ore_lavorate || ''};${row.ore_straordinario || ''};${row.tipo || ''};${(row.note || '').replace(/;/g, ',')}\n`;
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="presenze-${mesi[mese-1]}-${anno}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore export');
  }
});

module.exports = router;
