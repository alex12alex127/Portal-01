const db = require('../config/database');

async function creaNotifica(userId, tipo, titolo, messaggio) {
  const result = await db.query(
    'INSERT INTO notifiche (user_id, tipo, titolo, messaggio, letta, created_at) VALUES ($1, $2, $3, $4, false, NOW()) RETURNING *',
    [userId, tipo, titolo, messaggio || null]
  );
  return result.rows[0];
}

async function getNotificheUtente(userId, limit = 20) {
  const result = await db.query(
    'SELECT id, tipo, titolo, messaggio, letta, created_at FROM notifiche WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]
  );
  return result.rows;
}

async function contaNotificheNonLette(userId) {
  const result = await db.query(
    'SELECT COUNT(*)::int AS count FROM notifiche WHERE user_id = $1 AND letta = false',
    [userId]
  );
  return result.rows[0].count;
}

async function marcaNotificaComeLetta(notificaId, userId) {
  const result = await db.query(
    'UPDATE notifiche SET letta = true WHERE id = $1 AND user_id = $2 AND letta = false RETURNING id',
    [notificaId, userId]
  );
  if (result.rows.length === 0) throw new Error('Notifica non trovata o già letta');
  return result.rows[0];
}

async function marcaTutteComeLette(userId) {
  const result = await db.query(
    'UPDATE notifiche SET letta = true WHERE user_id = $1 AND letta = false',
    [userId]
  );
  return result.rowCount;
}

async function eliminaNotifica(notificaId, userId) {
  const result = await db.query(
    'DELETE FROM notifiche WHERE id = $1 AND user_id = $2 RETURNING id',
    [notificaId, userId]
  );
  if (result.rows.length === 0) throw new Error('Notifica non trovata');
  return result.rows[0];
}

async function eliminaTutteNotifiche(userId) {
  const result = await db.query(
    'DELETE FROM notifiche WHERE user_id = $1',
    [userId]
  );
  return result.rowCount;
}

module.exports = {
  creaNotifica,
  getNotificheUtente,
  contaNotificheNonLette,
  marcaNotificaComeLetta,
  marcaTutteComeLette,
  eliminaNotifica,
  eliminaTutteNotifiche
};
