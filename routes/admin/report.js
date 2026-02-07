const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { requireAuth, requireAdmin } = require('../../middleware/auth');
const { soloData } = require('../../lib/helpers');

router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const byStato = await db.query(
      `SELECT stato, COUNT(*)::int AS n, COALESCE(SUM(giorni_totali),0)::int AS giorni FROM ferie WHERE EXTRACT(YEAR FROM data_inizio) = $1 GROUP BY stato`,
      [year]
    );
    const byMese = await db.query(
      `SELECT EXTRACT(MONTH FROM data_inizio)::int AS mese, COUNT(*)::int AS n, COALESCE(SUM(giorni_totali),0)::int AS giorni FROM ferie WHERE EXTRACT(YEAR FROM data_inizio) = $1 AND stato = 'approved' GROUP BY mese ORDER BY mese`,
      [year]
    );
    const byUser = await db.query(
      `SELECT u.id, u.username, u.full_name, COUNT(f.id)::int AS richieste, COALESCE(SUM(CASE WHEN f.stato='approved' THEN f.giorni_totali ELSE 0 END),0)::int AS giorni_approvati, COALESCE(SUM(CASE WHEN f.stato='pending' THEN f.giorni_totali ELSE 0 END),0)::int AS giorni_pending FROM users u LEFT JOIN ferie f ON u.id = f.user_id AND EXTRACT(YEAR FROM f.data_inizio) = $1 WHERE u.is_active = true GROUP BY u.id, u.username, u.full_name ORDER BY giorni_approvati DESC`,
      [year]
    );
    const byTipo = await db.query(
      `SELECT tipo, COUNT(*)::int AS n, COALESCE(SUM(giorni_totali),0)::int AS giorni FROM ferie WHERE EXTRACT(YEAR FROM data_inizio) = $1 AND stato = 'approved' GROUP BY tipo`,
      [year]
    );
    const anni = await db.query('SELECT DISTINCT EXTRACT(YEAR FROM data_inizio)::int AS y FROM ferie ORDER BY y DESC');
    res.render('admin/report', {
      title: 'Report Ferie - Portal-01',
      activePage: 'adminReport',
      breadcrumbs: [{ label: 'Panoramica', url: '/dashboard' }, { label: 'Report Ferie' }],
      year,
      byStato: byStato.rows,
      byMese: byMese.rows,
      byUser: byUser.rows,
      byTipo: byTipo.rows,
      anni: anni.rows.map(r => r.y)
    });
  } catch (err) {
    console.error('[admin report]', err);
    res.status(500).send('Errore del server');
  }
});

router.get('/export', requireAuth, requireAdmin, async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const result = await db.query(
      `SELECT u.username, u.full_name, f.data_inizio, f.data_fine, f.giorni_totali, f.tipo, f.stato, f.note, f.created_at FROM ferie f JOIN users u ON u.id = f.user_id WHERE EXTRACT(YEAR FROM f.data_inizio) = $1 ORDER BY f.data_inizio`,
      [year]
    );
    let csv = 'Username,Nome,Data Inizio,Data Fine,Giorni,Tipo,Stato,Note,Creata il\n';
    result.rows.forEach(r => {
      csv += `"${r.username}","${r.full_name}","${soloData(r.data_inizio)}","${soloData(r.data_fine)}",${r.giorni_totali},"${r.tipo}","${r.stato}","${(r.note || '').replace(/"/g, '""')}","${soloData(r.created_at)}"\n`;
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="report-ferie-${year}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error('[admin report export]', err);
    res.status(500).json({ error: 'Errore export' });
  }
});

module.exports = router;
