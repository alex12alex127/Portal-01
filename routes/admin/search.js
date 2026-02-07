const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { requireAuth } = require('../../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  const q = (req.query.q && String(req.query.q).trim()) || '';
  if (!q || q.length < 2) return res.json({ results: [] });
  const like = '%' + q + '%';
  try {
    const results = [];
    // Cerca avvisi
    const avvisi = await db.query(
      `SELECT id, titolo, 'avviso' AS type FROM avvisi WHERE titolo ILIKE $1 OR contenuto ILIKE $1 LIMIT 5`, [like]
    );
    avvisi.rows.forEach(r => results.push({ type: 'avviso', id: r.id, label: r.titolo, url: '/avvisi/' + r.id }));
    // Cerca utenti (solo admin)
    if (req.session.user.role === 'admin') {
      const users = await db.query(
        `SELECT id, username, full_name, 'utente' AS type FROM users WHERE username ILIKE $1 OR full_name ILIKE $1 OR email ILIKE $1 LIMIT 5`, [like]
      );
      users.rows.forEach(r => results.push({ type: 'utente', id: r.id, label: r.full_name + ' (' + r.username + ')', url: '/admin/users' }));
    }
    // Cerca notifiche
    const notifiche = await db.query(
      `SELECT id, titolo, 'notifica' AS type FROM notifiche WHERE user_id = $1 AND (titolo ILIKE $2 OR messaggio ILIKE $2) LIMIT 5`, [req.session.user.id, like]
    );
    notifiche.rows.forEach(r => results.push({ type: 'notifica', id: r.id, label: r.titolo, url: '/notifiche' }));
    res.json({ results });
  } catch (err) {
    console.error('[search]', err);
    res.json({ results: [] });
  }
});

module.exports = router;
