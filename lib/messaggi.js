const db = require('../config/database');

/**
 * Crea una nuova conversazione con partecipanti.
 * @param {number} creatorId - ID utente che crea la conversazione
 * @param {string} oggetto - Oggetto della conversazione
 * @param {number[]} partecipantiIds - Array di user IDs (incluso il creatore)
 * @param {string} [primoMessaggio] - Testo del primo messaggio (opzionale)
 * @returns {object} conversazione creata
 */
async function creaConversazione(creatorId, oggetto, partecipantiIds, primoMessaggio) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const isGroup = partecipantiIds.length > 2;
    const convResult = await client.query(
      'INSERT INTO conversazioni (oggetto, created_by, is_group, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
      [oggetto, creatorId, isGroup]
    );
    const conv = convResult.rows[0];

    // Assicura che il creatore sia nei partecipanti
    const uniqueIds = [...new Set([creatorId, ...partecipantiIds])];
    for (const uid of uniqueIds) {
      await client.query(
        'INSERT INTO conversazione_partecipanti (conversazione_id, user_id, ultimo_letto) VALUES ($1, $2, NOW())',
        [conv.id, uid]
      );
    }

    // Primo messaggio opzionale
    if (primoMessaggio && primoMessaggio.trim()) {
      await client.query(
        'INSERT INTO messaggi (conversazione_id, sender_id, testo, created_at) VALUES ($1, $2, $3, NOW())',
        [conv.id, creatorId, primoMessaggio.trim()]
      );
    }

    await client.query('COMMIT');
    return conv;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Ottieni lista conversazioni per un utente con ultimo messaggio e conteggio non letti.
 */
async function getConversazioniUtente(userId) {
  const result = await db.query(`
    SELECT
      c.id,
      c.oggetto,
      c.is_group,
      c.created_at,
      c.updated_at,
      cp.archiviata,
      -- ultimo messaggio
      m_last.testo AS ultimo_messaggio,
      m_last.created_at AS ultimo_messaggio_at,
      u_last.full_name AS ultimo_messaggio_da,
      -- conteggio non letti
      COALESCE(unread.count, 0)::int AS non_letti,
      -- partecipanti (nomi)
      (
        SELECT string_agg(u2.full_name, ', ' ORDER BY u2.full_name)
        FROM conversazione_partecipanti cp2
        JOIN users u2 ON u2.id = cp2.user_id
        WHERE cp2.conversazione_id = c.id AND cp2.user_id != $1
      ) AS partecipanti_nomi
    FROM conversazioni c
    JOIN conversazione_partecipanti cp ON cp.conversazione_id = c.id AND cp.user_id = $1
    LEFT JOIN LATERAL (
      SELECT m.testo, m.created_at, m.sender_id
      FROM messaggi m
      WHERE m.conversazione_id = c.id
      ORDER BY m.created_at DESC
      LIMIT 1
    ) m_last ON true
    LEFT JOIN users u_last ON u_last.id = m_last.sender_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS count
      FROM messaggi m2
      WHERE m2.conversazione_id = c.id
        AND m2.created_at > cp.ultimo_letto
        AND m2.sender_id != $1
    ) unread ON true
    WHERE cp.archiviata = false
    ORDER BY COALESCE(m_last.created_at, c.created_at) DESC
  `, [userId]);
  return result.rows;
}

/**
 * Ottieni una singola conversazione con verifica partecipazione.
 */
async function getConversazione(convId, userId) {
  const result = await db.query(`
    SELECT c.*, cp.ultimo_letto, cp.archiviata
    FROM conversazioni c
    JOIN conversazione_partecipanti cp ON cp.conversazione_id = c.id AND cp.user_id = $2
    WHERE c.id = $1
  `, [convId, userId]);
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

/**
 * Ottieni i partecipanti di una conversazione.
 */
async function getPartecipanti(convId) {
  const result = await db.query(`
    SELECT u.id, u.full_name, u.username, u.role, u.email
    FROM conversazione_partecipanti cp
    JOIN users u ON u.id = cp.user_id
    WHERE cp.conversazione_id = $1
    ORDER BY u.full_name
  `, [convId]);
  return result.rows;
}

/**
 * Ottieni messaggi di una conversazione (paginati).
 */
async function getMessaggi(convId, limit = 50, offset = 0) {
  const result = await db.query(`
    SELECT m.id, m.testo, m.created_at, m.sender_id,
           u.full_name AS sender_name, u.role AS sender_role
    FROM messaggi m
    JOIN users u ON u.id = m.sender_id
    WHERE m.conversazione_id = $1
    ORDER BY m.created_at ASC
    LIMIT $2 OFFSET $3
  `, [convId, limit, offset]);
  return result.rows;
}

/**
 * Conta totale messaggi in una conversazione.
 */
async function contaMessaggi(convId) {
  const result = await db.query(
    'SELECT COUNT(*)::int AS count FROM messaggi WHERE conversazione_id = $1',
    [convId]
  );
  return result.rows[0].count;
}

/**
 * Invia un messaggio in una conversazione.
 */
async function inviaMessaggio(convId, senderId, testo) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const msgResult = await client.query(
      'INSERT INTO messaggi (conversazione_id, sender_id, testo, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [convId, senderId, testo.trim()]
    );

    // Aggiorna updated_at della conversazione
    await client.query(
      'UPDATE conversazioni SET updated_at = NOW() WHERE id = $1',
      [convId]
    );

    // Aggiorna ultimo_letto per il mittente
    await client.query(
      'UPDATE conversazione_partecipanti SET ultimo_letto = NOW() WHERE conversazione_id = $1 AND user_id = $2',
      [convId, senderId]
    );

    await client.query('COMMIT');
    return msgResult.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Segna conversazione come letta per un utente.
 */
async function segnaComeLetta(convId, userId) {
  await db.query(
    'UPDATE conversazione_partecipanti SET ultimo_letto = NOW() WHERE conversazione_id = $1 AND user_id = $2',
    [convId, userId]
  );
}

/**
 * Conta totale messaggi non letti per un utente (tutte le conversazioni).
 */
async function contaMessaggiNonLetti(userId) {
  const result = await db.query(`
    SELECT COALESCE(SUM(unread.cnt), 0)::int AS count
    FROM conversazione_partecipanti cp
    JOIN LATERAL (
      SELECT COUNT(*)::int AS cnt
      FROM messaggi m
      WHERE m.conversazione_id = cp.conversazione_id
        AND m.created_at > cp.ultimo_letto
        AND m.sender_id != $1
    ) unread ON true
    WHERE cp.user_id = $1 AND cp.archiviata = false
  `, [userId]);
  return result.rows[0].count;
}

/**
 * Archivia/disarchivia una conversazione per un utente.
 */
async function archiviaConversazione(convId, userId, archivia = true) {
  await db.query(
    'UPDATE conversazione_partecipanti SET archiviata = $3 WHERE conversazione_id = $1 AND user_id = $2',
    [convId, userId, archivia]
  );
}

/**
 * Ottieni tutti gli utenti attivi (per selezionare destinatari).
 */
async function getUtentiAttivi(excludeId) {
  const result = await db.query(
    'SELECT id, full_name, username, role, email FROM users WHERE is_active = true AND id != $1 ORDER BY full_name',
    [excludeId]
  );
  return result.rows;
}

module.exports = {
  creaConversazione,
  getConversazioniUtente,
  getConversazione,
  getPartecipanti,
  getMessaggi,
  contaMessaggi,
  inviaMessaggio,
  segnaComeLetta,
  contaMessaggiNonLetti,
  archiviaConversazione,
  getUtentiAttivi
};
