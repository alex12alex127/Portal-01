const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { validateRegister, validateLogin } = require('../middleware/validation');
const { loginLimiter, registerLimiter, checkLoginAttempts, recordLoginAttempt, logLoginAttempt } = require('../middleware/security');

router.get('/login', (req, res) => {
  res.render('auth/login', { csrfToken: req.session.csrfToken });
});

router.post('/login', loginLimiter, checkLoginAttempts, validateLogin, async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip;
  
  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) {
      await logLoginAttempt(username, false, ip);
      recordLoginAttempt(req.loginAttemptsKey, false);
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    
    const user = result.rows[0];
    
    // Verifica se l'account è attivo
    if (user.is_active === false) {
      return res.status(403).json({ error: 'Account disabilitato. Contatta l\'amministratore.' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      await logLoginAttempt(username, false, ip);
      recordLoginAttempt(req.loginAttemptsKey, false);
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    
    // Login riuscito
    await logLoginAttempt(username, true, ip);
    recordLoginAttempt(req.loginAttemptsKey, true);
    
    // Aggiorna ultimo login
    await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    
    req.session.userId = user.id;
    req.session.user = { 
      id: user.id, 
      username: user.username, 
      role: user.role, 
      full_name: user.full_name,
      email: user.email
    };
    
    res.json({ success: true, redirect: '/dashboard' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

router.get('/register', (req, res) => {
  res.render('auth/register', { csrfToken: req.session.csrfToken });
});

router.post('/register', registerLimiter, validateRegister, async (req, res) => {
  const { username, email, password, full_name } = req.body;
  
  try {
    // Verifica se username o email esistono già
    const existing = await db.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existing.rows.length > 0) {
      if (existing.rows[0].username === username) {
        return res.status(400).json({ error: 'Username già in uso' });
      }
      if (existing.rows[0].email === email) {
        return res.status(400).json({ error: 'Email già in uso' });
      }
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    await db.query(
      'INSERT INTO users (username, email, password, full_name) VALUES ($1, $2, $3, $4)',
      [username, email, hashedPassword, full_name]
    );
    
    console.log(`[${new Date().toISOString()}] New user registered: ${username}`);
    
    res.json({ success: true, redirect: '/auth/login' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore durante la registrazione' });
  }
});

router.get('/logout', (req, res) => {
  const username = req.session.user?.username;
  req.session.destroy((err) => {
    if (err) {
      console.error('Errore durante logout:', err);
    }
    console.log(`[${new Date().toISOString()}] User logged out: ${username}`);
    res.redirect('/auth/login');
  });
});

module.exports = router;
