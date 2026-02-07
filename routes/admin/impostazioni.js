const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth');
const { requirePermission } = require('../../lib/permissions');
const { apiLimiter } = require('../../middleware/security');
const { logAudit } = require('../../lib/audit');
const { getAllImpostazioni, setImpostazioniMultiple, initImpostazioni } = require('../../lib/impostazioni');

router.get('/', requireAuth, requirePermission('impostazioni.view'), async (req, res) => {
  try {
    await initImpostazioni();
    const { rows, byCategoria } = await getAllImpostazioni();
    res.render('admin/impostazioni', {
      title: 'Impostazioni Aziendali - Portal-01',
      activePage: 'adminImpostazioni',
      breadcrumbs: [{ label: 'Panoramica', url: '/dashboard' }, { label: 'Impostazioni' }],
      impostazioni: rows,
      byCategoria
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

router.post('/', requireAuth, requirePermission('impostazioni.edit'), apiLimiter, async (req, res) => {
  try {
    const { _csrf, ...updates } = req.body;
    await setImpostazioniMultiple(updates);
    await logAudit(req.session.user.id, 'impostazioni_aggiornate', `chiavi=${Object.keys(updates).join(',')}`, req.ip);
    res.json({ success: true, message: 'Impostazioni salvate' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore durante il salvataggio' });
  }
});

module.exports = router;
