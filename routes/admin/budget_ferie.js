const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../lib/permissions');
const { apiLimiter } = require('../../middleware/security');
const { logAudit } = require('../../lib/audit');
const { getBudgetTutti, setBudgetUtente, initBudgetAnno } = require('../../lib/budget_ferie');
const { getImpostazione } = require('../../lib/impostazioni');

router.get('/', requireAuth, requirePermission('budget.view_all'), async (req, res) => {
  const anno = parseInt(req.query.anno, 10) || new Date().getFullYear();
  try {
    const budget = await getBudgetTutti(anno);
    res.render('admin/budget_ferie', {
      title: 'Budget Ferie - Portal-01',
      activePage: 'adminBudget',
      breadcrumbs: [{ label: 'Panoramica', url: '/dashboard' }, { label: 'Budget Ferie' }],
      budget,
      anno
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

router.post('/init', requireAuth, requirePermission('budget.edit'), apiLimiter, async (req, res) => {
  const anno = parseInt(req.body.anno, 10) || new Date().getFullYear();
  try {
    const giorniDefault = await getImpostazione('ferie_giorni_default') || 26;
    const count = await initBudgetAnno(anno, giorniDefault);
    await logAudit(req.session.user.id, 'budget_ferie_init', `anno=${anno} nuovi=${count}`, req.ip);
    res.json({ success: true, message: `Budget inizializzato per ${count} dipendenti`, count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

router.put('/:userId', requireAuth, requirePermission('budget.edit'), apiLimiter, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (Number.isNaN(userId) || userId < 1) return res.status(400).json({ error: 'ID non valido' });
  const anno = parseInt(req.body.anno, 10) || new Date().getFullYear();
  const giorniSpettanti = parseFloat(req.body.giorni_spettanti);
  const giorniAggiuntivi = parseFloat(req.body.giorni_aggiuntivi) || 0;
  if (Number.isNaN(giorniSpettanti) || giorniSpettanti < 0) return res.status(400).json({ error: 'Giorni spettanti non validi' });
  try {
    await setBudgetUtente(userId, anno, giorniSpettanti, giorniAggiuntivi, req.body.note || null);
    await logAudit(req.session.user.id, 'budget_ferie_aggiornato', `user=${userId} anno=${anno} spettanti=${giorniSpettanti}`, req.ip);
    res.json({ success: true, message: 'Budget aggiornato' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore' });
  }
});

module.exports = router;
