const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');

router.get('/login', (req, res) => {
  res.render('auth/login');
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    
    req.session.userId = user.id;
    req.session.user = { id: user.id, username: user.username, role: user.role, full_name: user.full_name };
    
    res.json({ success: true, redirect: '/dashboard' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore del server' });
  }
});

router.get('/register', (req, res) => {
  res.render('auth/register');
});

router.post('/register', async (req, res) => {
  const { username, email, password, full_name } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await db.query(
      'INSERT INTO users (username, email, password, full_name) VALUES ($1, $2, $3, $4)',
      [username, email, hashedPassword, full_name]
    );
    
    res.json({ success: true, redirect: '/auth/login' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore durante la registrazione' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
});

module.exports = router;
