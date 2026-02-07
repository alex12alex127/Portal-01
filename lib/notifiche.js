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

async function getNotificheUtente(userId, limit = 10) {
  try {
    const result = await db.query(
      `SELECT id, tipo, titolo, messaggio, letta, created_at 
       FROM notifiche 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  } catch (err) {
    console.error('[notifiche get]', err.message);
    return [];
  }
}

async function contaNotificheNonLette(userId) {
  try {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM notifiche WHERE user_id = $1 AND letta = false',
      [userId]
    );
    return parseInt(result.rows[0].count);
  } catch (err) {
    console.error('[notifiche count]', err.message);
    return 0;
  }
}

async function marcaNotificaComeLetta(notificaId, userId) {
  try {
    await db.query(
      'UPDATE notifiche SET letta = true WHERE id = $1 AND user_id = $2',
      [notificaId, userId]
    );
  } catch (err) {
    console.error('[notifiche read]', err.message);
  }
}

async function marcaTutteComeLette(userId) {
  try {
    await db.query(
      'UPDATE notifiche SET letta = true WHERE user_id = $1 AND letta = false',
      [userId]
    );
  } catch (err) {
    console.error('[notifiche read all]', err.message);
  }
}

async function eliminaNotifica(notificaId, userId) {
  try {
    await db.query(
      'DELETE FROM notifiche WHERE id = $1 AND user_id = $2',
      [notificaId, userId]
    );
  } catch (err) {
    console.error('[notifiche delete]', err.message);
  }
}

module.exports = { 
  creaNotifica, 
  getNotificheUtente, 
  contaNotificheNonLette, 
  marcaNotificaComeLetta, 
  marcaTutteComeLette,
  eliminaNotifica
};
