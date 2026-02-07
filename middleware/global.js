const { contaAvvisiNonLetti } = require('../lib/avvisi');
const { contaNotificheNonLette } = require('../lib/notifiche');
const { contaMessaggiNonLetti } = require('../lib/messaggi');

// Middleware per aggiungere conteggi globali a tutte le richieste
async function addGlobalCounts(req, res, next) {
  // Aggiungi conteggi solo se utente è autenticato
  if (req.session && req.session.user) {
    try {
      // Calcola conteggi in parallelo
      const [avvisiNonLetti, notificheNonLette, messaggiNonLetti] = await Promise.all([
        contaAvvisiNonLetti(req.session.user.id),
        contaNotificheNonLette(req.session.user.id),
        contaMessaggiNonLetti(req.session.user.id)
      ]);
      
      // Rendi disponibili globalmente
      res.locals.avvisiNonLetti = avvisiNonLetti;
      res.locals.notificheNonLette = notificheNonLette;
      res.locals.messaggiNonLetti = messaggiNonLetti;
    } catch (err) {
      console.error('[global counts]', err.message);
      // In caso di errore, imposta a 0 per non bloccare l'app
      res.locals.avvisiNonLetti = 0;
      res.locals.notificheNonLette = 0;
      res.locals.messaggiNonLetti = 0;
    }
  } else {
    // Utente non autenticato
    res.locals.avvisiNonLetti = 0;
    res.locals.notificheNonLette = 0;
    res.locals.messaggiNonLetti = 0;
  }
  
  next();
}

module.exports = { addGlobalCounts };
