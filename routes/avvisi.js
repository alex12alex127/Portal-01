const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');
const {
  AnnouncementService,
  getAvvisiVisibili,
  getAvviso,
  marcaAvvisoComeLetto,
  contaAvvisiNonLetti
} = require('../lib/avvisi');

/**
 * Routes per gestione avvisi (utenti)
 * Pattern RESTful con error handling professionale
 */

/**
 * GET /avvisi - Lista avvisi visibili (pagina principale)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    console.log(`[AnnouncementsRoute] Caricamento pagina avvisi per utente ${userId}`);
    
    const [avvisi, nonLetti] = await Promise.all([
      getAvvisiVisibili(userId),
      contaAvvisiNonLetti(userId)
    ]);
    
    res.render('avvisi/index', {
      title: 'Avvisi - Portal-01',
      activePage: 'avvisi',
      breadcrumbs: [{ label: 'Dashboard', url: '/dashboard' }, { label: 'Avvisi' }],
      avvisi,
      nonLetti,
      isAdmin: req.session.user.role === 'admin'
    });
  } catch (error) {
    console.error('[AnnouncementsRoute] Errore caricamento pagina avvisi:', error);
    res.status(500).render('error', { 
      title: 'Errore', 
      message: 'Impossibile caricare gli avvisi' 
    });
  }
});

/**
 * GET /avvisi/api - API endpoint per caricamento avvisi (AJAX)
 */
router.get('/api', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    console.log(`[AnnouncementsRoute] API: Caricamento avvisi per utente ${userId}`);
    
    const [avvisi, nonLetti] = await Promise.all([
      getAvvisiVisibili(userId),
      contaAvvisiNonLetti(userId)
    ]);
    
    res.json({
      success: true,
      data: {
        avvisi,
        nonLetti,
        totalCount: avvisi.length
      },
      message: 'Avvisi caricati con successo'
    });
  } catch (error) {
    console.error('[AnnouncementsRoute] Errore API caricamento avvisi:', error);
    res.status(500).json({
      success: false,
      error: 'Errore caricamento avvisi',
      message: error.message
    });
  }
});

/**
 * GET /avvisi/:id - Dettaglio avviso specifico
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const avvisoId = parseInt(req.params.id);
    const userId = req.session.user.id;
    
    if (!avvisoId || isNaN(avvisoId)) {
      return res.status(400).render('error', {
        title: 'Errore',
        message: 'ID avviso non valido'
      });
    }
    
    console.log(`[AnnouncementsRoute] Caricamento dettaglio avviso ${avvisoId} per utente ${userId}`);
    
    const avviso = await getAvviso(avvisoId);
    if (!avviso) {
      return res.status(404).render('error', {
        title: 'Avviso non trovato',
        message: 'L\'avviso richiesto non esiste'
      });
    }
    
    // Marca come letto in background (non bloccante)
    marcaAvvisoComeLetto(avvisoId, userId).catch(err => {
      console.warn('[AnnouncementsRoute] Errore marcatura avviso come letto:', err);
    });
    
    res.render('avvisi/dettaglio', {
      title: `${avviso.titolo} - Portal-01`,
      activePage: 'avvisi',
      breadcrumbs: [
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'Avvisi', url: '/avvisi' },
        { label: avviso.titolo }
      ],
      avviso
    });
  } catch (error) {
    console.error('[AnnouncementsRoute] Errore caricamento dettaglio avviso:', error);
    res.status(500).render('error', { 
      title: 'Errore', 
      message: 'Impossibile caricare il dettaglio dell\'avviso' 
    });
  }
});

/**
 * POST /avvisi/:id/letta - Marca avviso come letto (AJAX)
 */
router.post('/:id/letta', requireAuth, apiLimiter, async (req, res) => {
  try {
    const avvisoId = parseInt(req.params.id);
    const userId = req.session.user.id;
    
    if (!avvisoId || isNaN(avvisoId)) {
      return res.status(400).json({
        success: false,
        error: 'ID avviso non valido'
      });
    }
    
    console.log(`[AnnouncementsRoute] Marcatura avviso ${avvisoId} come letto per utente ${userId}`);
    
    await marcaAvvisoComeLetto(avvisoId, userId);
    const newUnreadCount = await contaAvvisiNonLetti(userId);
    
    res.json({
      success: true,
      data: {
        avvisoId,
        nonLette: newUnreadCount
      },
      message: 'Avviso segnato come letto'
    });
  } catch (error) {
    console.error('[AnnouncementsRoute] Errore marcatura avviso come letto:', error);
    res.status(500).json({
      success: false,
      error: 'Errore marcatura avviso',
      message: error.message
    });
  }
});

module.exports = router;
