const db = require('../config/database');

async function creaNotifica(userId, tipo, titolo, messaggio) {
  try {
    await db.query(
      'INSERT INTO notifiche (user_id, tipo, titolo, messaggio) VALUES ($1, $2, $3, $4)',
      [userId, tipo, titolo || '', messaggio || null]
    );
  } catch (err) {
    console.error('[notifiche]', err.message);
  }
}

module.exports = { creaNotifica };
