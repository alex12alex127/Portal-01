const db = require('../config/database');

/**
 * Registra entrata (timbra in).
 */
async function timbraEntrata(userId, note) {
  const oggi = new Date().toISOString().slice(0, 10);
  const ora = new Date().toTimeString().slice(0, 5);
  // Controlla se esiste già una timbratura per oggi
  const existing = await db.query(
    'SELECT id, ora_entrata, ora_uscita FROM presenze WHERE user_id = $1 AND data = $2',
    [userId, oggi]
  );
  if (existing.rows.length > 0 && existing.rows[0].ora_entrata) {
    return { error: 'Entrata già registrata per oggi', existing: existing.rows[0] };
  }
  if (existing.rows.length > 0) {
    await db.query(
      'UPDATE presenze SET ora_entrata = $1, note = COALESCE($2, note), updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [ora, note || null, existing.rows[0].id]
    );
    return { success: true, ora_entrata: ora, data: oggi };
  }
  await db.query(
    'INSERT INTO presenze (user_id, data, ora_entrata, tipo, note) VALUES ($1, $2, $3, $4, $5)',
    [userId, oggi, ora, 'ordinario', note || null]
  );
  return { success: true, ora_entrata: ora, data: oggi };
}

/**
 * Registra uscita (timbra out) e calcola ore lavorate.
 */
async function timbraUscita(userId, note) {
  const oggi = new Date().toISOString().slice(0, 10);
  const ora = new Date().toTimeString().slice(0, 5);
  const existing = await db.query(
    'SELECT id, ora_entrata FROM presenze WHERE user_id = $1 AND data = $2',
    [userId, oggi]
  );
  if (existing.rows.length === 0 || !existing.rows[0].ora_entrata) {
    return { error: 'Devi prima timbrare l\'entrata' };
  }
  const row = existing.rows[0];
  // Calcola ore lavorate
  const [eh, em] = row.ora_entrata.split(':').map(Number);
  const [uh, um] = ora.split(':').map(Number);
  const oreLavorate = Math.round(((uh * 60 + um) - (eh * 60 + em)) / 60 * 10) / 10;
  // Calcola straordinario (oltre 8 ore di default)
  const oreStraordinario = Math.max(0, Math.round((oreLavorate - 8) * 10) / 10);

  await db.query(
    `UPDATE presenze SET ora_uscita = $1, ore_lavorate = $2, ore_straordinario = $3,
     note = COALESCE($4, note), updated_at = CURRENT_TIMESTAMP WHERE id = $5`,
    [ora, oreLavorate, oreStraordinario, note || null, row.id]
  );
  return { success: true, ora_uscita: ora, ore_lavorate: oreLavorate, ore_straordinario: oreStraordinario };
}

/**
 * Recupera la timbratura di oggi per un utente.
 */
async function getPresenzaOggi(userId) {
  const oggi = new Date().toISOString().slice(0, 10);
  const r = await db.query(
    'SELECT * FROM presenze WHERE user_id = $1 AND data = $2',
    [userId, oggi]
  );
  return r.rows[0] || null;
}

/**
 * Recupera le presenze di un utente per un mese.
 */
async function getPresenzeMese(userId, anno, mese) {
  const r = await db.query(
    `SELECT * FROM presenze WHERE user_id = $1
     AND EXTRACT(YEAR FROM data) = $2 AND EXTRACT(MONTH FROM data) = $3
     ORDER BY data`,
    [userId, anno, mese]
  );
  return r.rows.map(row => ({
    ...row,
    data: typeof row.data === 'string' ? row.data.slice(0, 10) : row.data.toISOString().slice(0, 10)
  }));
}

/**
 * Recupera il riepilogo mensile di un utente.
 */
async function getRiepilogoMese(userId, anno, mese) {
  const presenze = await getPresenzeMese(userId, anno, mese);
  const giorniPresente = presenze.filter(p => p.ora_entrata).length;
  const oreTotali = presenze.reduce((sum, p) => sum + (parseFloat(p.ore_lavorate) || 0), 0);
  const oreStraordinario = presenze.reduce((sum, p) => sum + (parseFloat(p.ore_straordinario) || 0), 0);
  return { giorniPresente, oreTotali: Math.round(oreTotali * 10) / 10, oreStraordinario: Math.round(oreStraordinario * 10) / 10, presenze };
}

/**
 * Admin: presenze di tutti per un giorno.
 */
async function getPresenzeGiorno(data) {
  const r = await db.query(
    `SELECT p.*, u.full_name, u.username, r.nome AS reparto_nome
     FROM presenze p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN reparti r ON r.id = u.reparto_id
     WHERE p.data = $1 ORDER BY u.full_name`,
    [data]
  );
  return r.rows;
}

/**
 * Admin: riepilogo presenze di tutti per un mese.
 */
async function getRiepilogoTuttiMese(anno, mese) {
  const r = await db.query(
    `SELECT u.id AS user_id, u.full_name, u.username, r.nome AS reparto_nome,
            COUNT(CASE WHEN p.ora_entrata IS NOT NULL THEN 1 END)::int AS giorni_presente,
            COALESCE(SUM(p.ore_lavorate), 0)::numeric AS ore_totali,
            COALESCE(SUM(p.ore_straordinario), 0)::numeric AS ore_straordinario
     FROM users u
     LEFT JOIN presenze p ON p.user_id = u.id
       AND EXTRACT(YEAR FROM p.data) = $1 AND EXTRACT(MONTH FROM p.data) = $2
     LEFT JOIN reparti r ON r.id = u.reparto_id
     WHERE u.is_active = true
     GROUP BY u.id, u.full_name, u.username, r.nome
     ORDER BY u.full_name`,
    [anno, mese]
  );
  return r.rows.map(row => ({
    ...row,
    ore_totali: Math.round(parseFloat(row.ore_totali) * 10) / 10,
    ore_straordinario: Math.round(parseFloat(row.ore_straordinario) * 10) / 10
  }));
}

/**
 * Admin: inserisce/modifica manualmente una presenza.
 */
async function setPresenzaManuale(userId, data, oraEntrata, oraUscita, tipo, note) {
  let oreLavorate = null;
  let oreStraordinario = 0;
  if (oraEntrata && oraUscita) {
    const [eh, em] = oraEntrata.split(':').map(Number);
    const [uh, um] = oraUscita.split(':').map(Number);
    oreLavorate = Math.round(((uh * 60 + um) - (eh * 60 + em)) / 60 * 10) / 10;
    oreStraordinario = Math.max(0, Math.round((oreLavorate - 8) * 10) / 10);
  }
  const r = await db.query(
    `INSERT INTO presenze (user_id, data, ora_entrata, ora_uscita, ore_lavorate, ore_straordinario, tipo, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, data) DO UPDATE SET
       ora_entrata = $3, ora_uscita = $4, ore_lavorate = $5, ore_straordinario = $6, tipo = $7, note = $8, updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [userId, data, oraEntrata || null, oraUscita || null, oreLavorate, oreStraordinario, tipo || 'ordinario', note || null]
  );
  return r.rows[0];
}

module.exports = {
  timbraEntrata,
  timbraUscita,
  getPresenzaOggi,
  getPresenzeMese,
  getRiepilogoMese,
  getPresenzeGiorno,
  getRiepilogoTuttiMese,
  setPresenzaManuale
};
