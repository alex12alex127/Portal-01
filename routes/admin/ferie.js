const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { requireAuth, requireManager } = require('../../middleware/auth');
const { apiLimiter } = require('../../middleware/security');
const { creaNotifica } = require('../../lib/notifiche');
const { logAudit } = require('../../lib/audit');
const { sendFerieEmail } = require('../../lib/email');
const { soloData } = require('../../lib/helpers');

router.get('/', requireAuth, requireManager, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * limit;
    const statoFilter = (req.query.stato && ['pending', 'approved', 'rejected'].includes(req.query.stato)) ? req.query.stato : '';
    const userIdFilter = parseInt(req.query.user_id, 10);
    let where = '';
    const countParams = [];
    const listParams = [];
    let n = 1;
    if (statoFilter) {
      where = ' WHERE f.stato = $' + n;
      countParams.push(statoFilter);
      listParams.push(statoFilter);
      n++;
    }
    if (!Number.isNaN(userIdFilter) && userIdFilter > 0) {
      where += (where ? ' AND' : ' WHERE') + ' f.user_id = $' + n;
      countParams.push(userIdFilter);
      listParams.push(userIdFilter);
      n++;
    }
    const countResult = await db.query('SELECT COUNT(*)::int AS total FROM ferie f JOIN users u ON u.id = f.user_id' + where, countParams);
    const total = countResult.rows[0].total;
    listParams.push(limit, offset);
    const result = await db.query(
      'SELECT f.id, f.user_id, f.data_inizio, f.data_fine, f.giorni_totali, f.tipo, f.stato, f.note, f.codice_protocollo, f.created_at, u.username, u.full_name FROM ferie f JOIN users u ON u.id = f.user_id' + where + ' ORDER BY f.created_at DESC LIMIT $' + n + ' OFFSET $' + (n + 1),
      listParams
    );
    const ferie = result.rows.map(r => ({
      ...r,
      data_inizio: soloData(r.data_inizio),
      data_fine: soloData(r.data_fine)
    }));
    const totalPages = Math.ceil(total / limit) || 1;
    const usersList = await db.query('SELECT id, username, full_name FROM users ORDER BY username');
    res.render('admin/ferie', {
      title: 'Richieste Ferie - Portal-01',
      activePage: 'adminFerie',
      breadcrumbs: [{ label: 'Panoramica', url: '/dashboard' }, { label: 'Approva Ferie' }],
      ferie,
      pagination: { page, limit, total, totalPages },
      filtri: { stato: statoFilter, user_id: Number.isNaN(userIdFilter) ? '' : userIdFilter },
      usersList: usersList.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

router.post('/:id/approve', requireAuth, requireManager, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID richiesta non valido' });
  const commento = (req.body.commento_admin && String(req.body.commento_admin).trim()) || null;
  try {
    const r = await db.query('UPDATE ferie SET stato = $1, commento_admin = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND stato = $4 RETURNING id, user_id, data_inizio, data_fine', ['approved', commento, id, 'pending']);
    if (r.rows.length === 0) return res.status(400).json({ error: 'Richiesta non trovata o già gestita' });
    const row = r.rows[0];
    const dataInizio = row.data_inizio ? String(row.data_inizio).slice(0, 10) : '';
    const dataFine = row.data_fine ? String(row.data_fine).slice(0, 10) : '';
    const msg = `La tua richiesta dal ${dataInizio} al ${dataFine} è stata approvata.` + (commento ? ` Nota: ${commento}` : '');
    await creaNotifica(row.user_id, 'ferie_approvata', 'Richiesta ferie approvata', msg);
    await sendFerieEmail(row.user_id, 'approvata', dataInizio, dataFine, commento);
    await logAudit(req.session.user.id, 'ferie_approvata', `id=${id} user_id=${row.user_id}`, req.ip);
    res.json({ success: true, message: 'Richiesta approvata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.post('/:id/reject', requireAuth, requireManager, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID richiesta non valido' });
  const commento = (req.body.commento_admin && String(req.body.commento_admin).trim()) || null;
  try {
    const r = await db.query('UPDATE ferie SET stato = $1, commento_admin = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND stato = $4 RETURNING id, user_id, data_inizio, data_fine', ['rejected', commento, id, 'pending']);
    if (r.rows.length === 0) return res.status(400).json({ error: 'Richiesta non trovata o già gestita' });
    const row = r.rows[0];
    const dataInizio = row.data_inizio ? String(row.data_inizio).slice(0, 10) : '';
    const dataFine = row.data_fine ? String(row.data_fine).slice(0, 10) : '';
    const msg = `La tua richiesta dal ${dataInizio} al ${dataFine} è stata rifiutata.` + (commento ? ` Motivo: ${commento}` : '');
    await creaNotifica(row.user_id, 'ferie_rifiutata', 'Richiesta ferie rifiutata', msg);
    await sendFerieEmail(row.user_id, 'rifiutata', dataInizio, dataFine, commento);
    await logAudit(req.session.user.id, 'ferie_rifiutata', `id=${id} user_id=${row.user_id}`, req.ip);
    res.json({ success: true, message: 'Richiesta rifiutata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.get('/calendar', requireAuth, requireManager, async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
    if (month < 1 || month > 12) return res.status(400).json({ error: 'Mese non valido' });
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const start = firstDay.toISOString().slice(0, 10);
    const end = lastDay.toISOString().slice(0, 10);
    const result = await db.query(`
      SELECT f.id, f.user_id, f.data_inizio, f.data_fine, f.giorni_totali, f.tipo, f.stato, f.note,
             u.username, u.full_name
      FROM ferie f
      JOIN users u ON u.id = f.user_id
      WHERE f.stato IN ('approved', 'pending')
        AND f.data_inizio <= $1 AND f.data_fine >= $2
    `, [end, start]);
    const byDate = {};
    for (const row of result.rows) {
      const startStr = soloData(row.data_inizio);
      const endStr = soloData(row.data_fine);
      const [sy, sm, sd] = startStr.split('-').map(Number);
      const [ey, em, ed] = endStr.split('-').map(Number);
      const dStart = new Date(sy, sm - 1, sd);
      const dEnd = new Date(ey, em - 1, ed);
      const entry = {
        id: row.id, user_id: row.user_id, username: row.username, full_name: row.full_name,
        data_inizio: startStr, data_fine: endStr, giorni_totali: row.giorni_totali,
        tipo: row.tipo, stato: row.stato, note: row.note || ''
      };
      for (let d = new Date(dStart.getTime()); d.getTime() <= dEnd.getTime(); d.setDate(d.getDate() + 1)) {
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push(entry);
      }
    }
    res.json({ year, month, byDate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

router.put('/:id', requireAuth, requireManager, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID richiesta non valido' });
  const { data_inizio, data_fine, tipo, note } = req.body || {};
  const codice_protocollo = (req.body.codice_protocollo && String(req.body.codice_protocollo).trim()) || null;
  if (!data_inizio || !data_fine) return res.status(400).json({ error: 'Data inizio e data fine richieste' });
  const inizio = new Date(data_inizio);
  const fine = new Date(data_fine);
  if (inizio > fine) return res.status(400).json({ error: 'Data inizio deve essere prima della data fine' });
  const tipoVal = ['ferie', 'permesso', 'malattia'].includes(tipo) ? tipo : 'ferie';
  if (tipoVal === 'malattia' && !codice_protocollo) {
    return res.status(400).json({ error: 'Il codice protocollo del medico è obbligatorio per le richieste di malattia' });
  }
  const giorni = Math.ceil((fine - inizio) / (1000 * 60 * 60 * 24)) + 1;
  try {
    const r = await db.query(
      'UPDATE ferie SET data_inizio = $1, data_fine = $2, giorni_totali = $3, tipo = $4, note = $5, codice_protocollo = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING id',
      [data_inizio, data_fine, giorni, tipoVal, note || null, tipoVal === 'malattia' ? codice_protocollo : null, id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Richiesta non trovata' });
    res.json({ success: true, message: 'Richiesta aggiornata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.delete('/:id', requireAuth, requireManager, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID richiesta non valido' });
  try {
    const r = await db.query('DELETE FROM ferie WHERE id = $1 RETURNING id', [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Richiesta non trovata' });
    res.json({ success: true, message: 'Richiesta cancellata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

module.exports = router;
