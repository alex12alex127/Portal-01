const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  if (req.session.userId) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/auth/login');
  }
});

router.get('/dashboard', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }
  res.render('dashboard', { user: req.session.user });
});

module.exports = router;
