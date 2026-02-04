const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

router.get('/', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/dashboard');
  res.redirect('/auth/login');
});

router.get('/health', (req, res) => {
  res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
});

router.get('/health/db', async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ ok: false, db: 'disconnected', error: 'DATABASE_URL non configurata' });
  try {
    await db.query('SELECT 1');
    res.status(200).json({ ok: true, db: 'connected' });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'disconnected', error: err.message });
  }
});

router.get('/dashboard', requireAuth, (req, res) => {
  res.render('dashboard', { title: 'Dashboard - Portal-01', activePage: 'dashboard' });
});

module.exports = router;
