const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { 
  NotificationService,
  getNotificheUtente, 
  contaNotificheNonLette, 
  marcaNotificaComeLetta, 
  marcaTutteComeLette,
  eliminaNotifica
} = require('../lib/notifiche');

/**
 * Routes per gestione notifiche utente
 * Pattern RESTful con error handling professionale
 */

// Middleware per autenticazione su tutte le route
router.use(requireAuth);

/**
 * GET /notifiche - Pagina principale notifiche
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    console.log(`[NotificationsRoute] Caricamento pagina notifiche per utente ${userId}`);
    
    const [notifiche, nonLette] = await Promise.all([
      getNotificheUtente(userId, 20),
      contaNotificheNonLette(userId)
    ]);
    
    res.render('notifiche/index', {
      title: 'Notifiche - Portal-01',
      activePage: 'notifiche',
      breadcrumbs: [{ label: 'Dashboard', url: '/dashboard' }, { label: 'Notifiche' }],
      notifiche,
      nonLette
    });
  } catch (error) {
    console.error('[NotificationsRoute] Errore caricamento pagina notifiche:', error);
    res.status(500).render('error', { 
      title: 'Errore', 
      message: 'Impossibile caricare le notifiche' 
    });
  }
});

/**
 * GET /notifiche/api - API endpoint per caricamento notifiche (AJAX)
 */
router.get('/api', async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    console.log(`[NotificationsRoute] API: Caricamento notifiche per utente ${userId}`);
    
    const [notifiche, nonLette] = await Promise.all([
      getNotificheUtente(userId, 20),
      contaNotificheNonLette(userId)
    ]);
    
    res.json({
      success: true,
      data: {
        notifiche,
        nonLette,
        totalCount: notifiche.length
      },
      message: 'Notifiche caricate con successo'
    });
  } catch (error) {
    console.error('[NotificationsRoute] Errore API caricamento notifiche:', error);
    res.status(500).json({
      success: false,
      error: 'Errore caricamento notifiche',
      message: error.message
    });
  }
});

/**
 * GET /notifiche/count - Conteggio notifiche non lette
 */
router.get('/count', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const count = await contaNotificheNonLette(userId);
    
    res.json({
      success: true,
      data: { count },
      message: 'Conteggio notifiche non lette'
    });
  } catch (error) {
    console.error('[NotificationsRoute] Errore conteggio notifiche:', error);
    res.status(500).json({
      success: false,
      error: 'Errore conteggio notifiche',
      message: error.message
    });
  }
});

/**
 * POST /notifiche/:id/read - Marca notifica come letta
 */
router.post('/:id/read', async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    const userId = req.session.user.id;
    
    if (!notificationId || isNaN(notificationId)) {
      return res.status(400).json({
        success: false,
        error: 'ID notifica non valido'
      });
    }
    
    console.log(`[NotificationsRoute] Marcatura notifica ${notificationId} come letta per utente ${userId}`);
    
    const notification = await marcaNotificaComeLetta(notificationId, userId);
    const newUnreadCount = await contaNotificheNonLette(userId);
    
    res.json({
      success: true,
      data: {
        notification,
        nonLette: newUnreadCount
      },
      message: 'Notifica marcata come letta'
    });
  } catch (error) {
    console.error('[NotificationsRoute] Errore marcatura notifica:', error);
    res.status(500).json({
      success: false,
      error: 'Errore marcatura notifica',
      message: error.message
    });
  }
});

/**
 * POST /notifiche/read-all - Marca tutte le notifiche come lette
 */
router.post('/read-all', async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    console.log(`[NotificationsRoute] Marcatura tutte le notifiche come lette per utente ${userId}`);
    
    const updatedCount = await marcaTutteComeLette(userId);
    
    res.json({
      success: true,
      data: {
        updatedCount,
        nonLette: 0
      },
      message: `${updatedCount} notifiche marcate come lette`
    });
  } catch (error) {
    console.error('[NotificationsRoute] Errore marcatura tutte notifiche:', error);
    res.status(500).json({
      success: false,
      error: 'Errore marcatura notifiche',
      message: error.message
    });
  }
});

/**
 * DELETE /notifiche/:id - Elimina notifica specifica
 */
router.delete('/:id', async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    const userId = req.session.user.id;
    
    if (!notificationId || isNaN(notificationId)) {
      return res.status(400).json({
        success: false,
        error: 'ID notifica non valido'
      });
    }
    
    console.log(`[NotificationsRoute] Eliminazione notifica ${notificationId} per utente ${userId}`);
    
    const deletedNotification = await eliminaNotifica(notificationId, userId);
    const newUnreadCount = await contaNotificheNonLette(userId);
    
    res.json({
      success: true,
      data: {
        notification: deletedNotification,
        nonLette: newUnreadCount
      },
      message: 'Notifica eliminata'
    });
  } catch (error) {
    console.error('[NotificationsRoute] Errore eliminazione notifica:', error);
    res.status(500).json({
      success: false,
      error: 'Errore eliminazione notifica',
      message: error.message
    });
  }
});

/**
 * DELETE /notifiche/delete-all - Elimina tutte le notifiche
 */
router.delete('/delete-all', async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    console.log(`[NotificationsRoute] Eliminazione tutte le notifiche per utente ${userId}`);
    
    const deletedCount = await NotificationService.deleteAll(userId);
    
    res.json({
      success: true,
      data: {
        deletedCount,
        nonLette: 0
      },
      message: `${deletedCount} notifiche eliminate`
    });
  } catch (error) {
    console.error('[NotificationsRoute] Errore eliminazione tutte notifiche:', error);
    res.status(500).json({
      success: false,
      error: 'Errore eliminazione notifiche',
      message: error.message
    });
  }
});

module.exports = router;
