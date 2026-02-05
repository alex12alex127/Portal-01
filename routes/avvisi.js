const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');

const oggi = () => new Date().toISOString().slice(0, 10);

function isVisibile(avviso) {
  const da = avviso.visibile_da ? String(avviso.visibile_da).slice(0, 10) : null;
  const fino = avviso.visibile_fino ? String(avviso.visibile_fino).slice(0, 10) : null;
  const today = oggi();
  if (da && today < da) return false;
  if (fino && today > fino) return false;
  return true;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT a.id, a.titolo, a.contenuto, a.tipo, a.in_evidenza, a.visibile_da, a.visibile_fino, a.created_at, a.updated_at,
             u.full_name AS autore_nome
      FROM avvisi a
      LEFT JOIN users u ON u.id = a.created_by
      ORDER BY a.in_evidenza DESC, a.created_at DESC
    `);
    const lettiResult = await db.query('SELECT avviso_id FROM avvisi_letti WHERE user_id = $1', [req.session.userId]);
    const lettiSet = new Set(lettiResult.rows.map(r => r.avviso_id));
    const avvisi = result.rows
      .map(r => ({
        ...r,
        visibile_da: r.visibile_da ? String(r.visibile_da).slice(0, 10) : null,
        visibile_fino: r.visibile_fino ? String(r.visibile_fino).slice(0, 10) : null,
        created_at: r.created_at,
        letto: lettiSet.has(r.id)
      }))
      .filter(a => isVisibile(a));
    res.render('avvisi/index', {
      title: 'Avvisi - Portal-01',
      activePage: 'avvisi',
      breadcrumbs: [{ label: 'Dashboard', url: '/dashboard' }, { label: 'Avvisi' }],
      avvisi
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

router.post('/:id/letta', requireAuth, apiLimiter, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'ID non valido' });
  try {
    await db.query(
      'INSERT INTO avvisi_letti (user_id, avviso_id) VALUES ($1, $2) ON CONFLICT (user_id, avviso_id) DO NOTHING',
      [req.session.userId, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

module.exports = router;
