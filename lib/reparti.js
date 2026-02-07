const db = require('../config/database');

async function getAllReparti() {
  const r = await db.query(
    `SELECT r.*, u.full_name AS responsabile_nome
     FROM reparti r LEFT JOIN users u ON u.id = r.responsabile_id
     ORDER BY r.nome`
  );
  return r.rows;
}

async function getReparto(id) {
  const r = await db.query('SELECT * FROM reparti WHERE id = $1', [id]);
  return r.rows[0] || null;
}

async function creaReparto(nome, descrizione, responsabileId) {
  const r = await db.query(
    'INSERT INTO reparti (nome, descrizione, responsabile_id) VALUES ($1, $2, $3) RETURNING *',
    [nome, descrizione || null, responsabileId || null]
  );
  return r.rows[0];
}

async function aggiornaReparto(id, nome, descrizione, responsabileId) {
  const r = await db.query(
    'UPDATE reparti SET nome = $1, descrizione = $2, responsabile_id = $3 WHERE id = $4 RETURNING *',
    [nome, descrizione || null, responsabileId || null, id]
  );
  return r.rows[0];
}

async function eliminaReparto(id) {
  // Rimuovi riferimenti dagli utenti prima
  await db.query('UPDATE users SET reparto_id = NULL WHERE reparto_id = $1', [id]);
  const r = await db.query('DELETE FROM reparti WHERE id = $1 RETURNING id', [id]);
  return r.rows[0];
}

async function getDipendentiReparto(repartoId) {
  const r = await db.query(
    'SELECT id, username, full_name, role, email FROM users WHERE reparto_id = $1 AND is_active = true ORDER BY full_name',
    [repartoId]
  );
  return r.rows;
}

module.exports = { getAllReparti, getReparto, creaReparto, aggiornaReparto, eliminaReparto, getDipendentiReparto };
