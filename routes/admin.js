const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');

// Pagina gestione utenti (solo admin)
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, email, full_name, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC'
    );
    res.render('admin/users', { 
      users: result.rows, 
      user: req.session.user,
      csrfToken: req.session.csrfToken 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

// Cambia ruolo utente
router.post('/users/:id/role', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  
  const validRoles = ['admin', 'manager', 'user'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Ruolo non valido' });
  }
  
  try {
    // Non permettere di cambiare il proprio ruolo
    if (parseInt(id) === req.session.userId) {
      return res.status(400).json({ error: 'Non puoi cambiare il tuo ruolo' });
    }
    
    await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    console.log(`[${new Date().toISOString()}] Admin ${req.session.userId} changed role of user ${id} to ${role}`);
    res.json({ success: true, message: 'Ruolo aggiornato' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento' });
  }
});

// Attiva/disattiva utente
router.post('/users/:id/toggle', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Non permettere di disattivare se stesso
    if (parseInt(id) === req.session.userId) {
      return res.status(400).json({ error: 'Non puoi disattivare il tuo account' });
    }
    
    const result = await db.query(
      'UPDATE users SET is_active = NOT is_active WHERE id = $1 RETURNING is_active',
      [id]
    );
    
    const newStatus = result.rows[0].is_active;
    console.log(`[${new Date().toISOString()}] Admin ${req.session.userId} ${newStatus ? 'activated' : 'deactivated'} user ${id}`);
    
    res.json({ 
      success: true, 
      message: newStatus ? 'Utente attivato' : 'Utente disattivato',
      is_active: newStatus
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento' });
  }
});

// Elimina utente
router.delete('/users/:id', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  const { id } = req.params;
  
  try {
    // Non permettere di eliminare se stesso
    if (parseInt(id) === req.session.userId) {
      return res.status(400).json({ error: 'Non puoi eliminare il tuo account' });
    }
    
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    console.log(`[${new Date().toISOString()}] Admin ${req.session.userId} deleted user ${id}`);
    res.json({ success: true, message: 'Utente eliminato' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore durante l\'eliminazione' });
  }
});

// Reset password utente (admin)
router.post('/users/:id/reset-password', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body;
  
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ error: 'Password deve essere almeno 8 caratteri' });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, id]);
    
    console.log(`[${new Date().toISOString()}] Admin ${req.session.userId} reset password for user ${id}`);
    res.json({ success: true, message: 'Password reimpostata' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore durante il reset' });
  }
});

module.exports = router;
