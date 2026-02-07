const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { soloData } = require('../lib/helpers');
const { getFormazioni, getDpiConsegne, getInfortuni, getDocumentiSicurezza, getScadenzeSicurezza } = require('../lib/sicurezza');

// GET /sicurezza — vista utente: le mie formazioni, i miei DPI, documenti sicurezza
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const tab = req.query.tab || 'formazioni';

    const [formazioni, dpiConsegne, infortuni, documenti, scadenze] = await Promise.all([
      getFormazioni({ user_id: userId }),
      getDpiConsegne({ user_id: userId }),
      getInfortuni({ user_id: userId }),
      getDocumentiSicurezza({}),
      getScadenzeSicurezza(30)
    ]);

    const fmt = r => ({ ...r, data_corso: r.data_corso ? soloData(r.data_corso) : '', data_scadenza: r.data_scadenza ? soloData(r.data_scadenza) : '' });
    const fmtDpi = r => ({ ...r, data_consegna: soloData(r.data_consegna), data_scadenza: r.data_scadenza ? soloData(r.data_scadenza) : '' });
    const fmtInf = r => ({ ...r, data_evento: soloData(r.data_evento), data_rientro: r.data_rientro ? soloData(r.data_rientro) : '' });
    const fmtDoc = r => ({ ...r, data_approvazione: r.data_approvazione ? soloData(r.data_approvazione) : '', data_scadenza: r.data_scadenza ? soloData(r.data_scadenza) : '' });

    // Filtra scadenze solo per l'utente corrente
    const mieScadenze = {
      formazioni: scadenze.formazioni.filter(s => s.user_id === userId).map(s => ({ ...s, data_scadenza: soloData(s.data_scadenza) })),
      dpi: scadenze.dpi.filter(s => s.user_id === userId).map(s => ({ ...s, data_scadenza: soloData(s.data_scadenza) })),
      documenti: scadenze.documenti.map(s => ({ ...s, data_scadenza: soloData(s.data_scadenza) }))
    };
    mieScadenze.totale = mieScadenze.formazioni.length + mieScadenze.dpi.length + mieScadenze.documenti.length;

    res.render('sicurezza/index', {
      title: 'Sicurezza sul Lavoro - Portal-01',
      activePage: 'sicurezza',
      breadcrumbs: [{ label: 'Panoramica', url: '/dashboard' }, { label: 'Sicurezza sul Lavoro' }],
      tab,
      formazioni: formazioni.map(fmt),
      dpiConsegne: dpiConsegne.map(fmtDpi),
      infortuni: infortuni.map(fmtInf),
      documenti: documenti.map(fmtDoc),
      scadenze: mieScadenze
    });
  } catch (err) {
    console.error('[sicurezza user]', err);
    res.status(500).send('Errore del server');
  }
});

module.exports = router;
