const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  res.redirect('/auth/login');
});

router.get('/dashboard', requireAuth, (req, res) => {
  res.render('dashboard', { user: req.session.user, csrfToken: req.session.csrfToken });
});

module.exports = router;
