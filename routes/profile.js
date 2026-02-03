const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/security');

// Pagina profilo
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, email, full_name, role, last_login, created_at FROM users WHERE id = $1',
      [req.session.userId]
    );
    
    if (result.rows.length === 0) {
      return res.redirect('/auth/logout');
    }
    
    res.render('profile/index', { 
      profile: result.rows[0],
      user: req.session.user,
      csrfToken: req.session.csrfToken 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Errore del server');
  }
});

// Cambia password
router.post('/change-password', requireAuth, apiLimiter, async (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;
  
  // Validazione
  if (!current_password || !new_password || !confirm_password) {
    return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
  }
  
  if (new_password !== confirm_password) {
    return res.status(400).json({ error: 'Le nuove password non coincidono' });
  }
  
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'La password deve essere almeno 8 caratteri' });
  }
  
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(new_password)) {
    return res.status(400).json({ error: 'Password deve contenere maiuscole, minuscole e numeri' });
  }
  
  try {
    // Verifica password corrente
    const result = await db.query('SELECT password FROM users WHERE id = $1', [req.session.userId]);
    const user = result.rows[0];
    
    const validPassword = await bcrypt.compare(current_password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Password corrente non valida' });
    }
    
    // Aggiorna password
    const hashedPassword = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.session.userId]);
    
    console.log(`[${new Date().toISOString()}] User ${req.session.userId} changed password`);
    res.json({ success: true, message: 'Password cambiata con successo' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore durante il cambio password' });
  }
});

// Aggiorna profilo
router.post('/update', requireAuth, apiLimiter, async (req, res) => {
  const { full_name, email } = req.body;
  
  if (!full_name || full_name.length < 2) {
    return res.status(400).json({ error: 'Nome completo richiesto' });
  }
  
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email non valida' });
  }
  
  try {
    // Verifica se email è già usata da altro utente
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email, req.session.userId]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email già in uso' });
    }
    
    await db.query(
      'UPDATE users SET full_name = $1, email = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [full_name, email, req.session.userId]
    );
    
    // Aggiorna sessione
    req.session.user.full_name = full_name;
    req.session.user.email = email;
    
    console.log(`[${new Date().toISOString()}] User ${req.session.userId} updated profile`);
    res.json({ success: true, message: 'Profilo aggiornato' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento' });
  }
});

module.exports = router;
