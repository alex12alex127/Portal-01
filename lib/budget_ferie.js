const db = require('../config/database');

/**
 * Recupera il budget ferie di un utente per un anno.
 */
async function getBudgetUtente(userId, anno) {
  const r = await db.query(
    'SELECT * FROM budget_ferie WHERE user_id = $1 AND anno = $2',
    [userId, anno]
  );
  if (r.rows.length === 0) return null;
  return r.rows[0];
}

/**
 * Recupera il saldo ferie: spettanti - consumati (approvati).
 */
async function getSaldoFerie(userId, anno) {
  const budget = await getBudgetUtente(userId, anno);
  const spettanti = budget ? parseFloat(budget.giorni_spettanti) + parseFloat(budget.giorni_aggiuntivi || 0) : 0;

  const consumati = await db.query(
    `SELECT COALESCE(SUM(giorni_totali), 0)::numeric AS giorni
     FROM ferie WHERE user_id = $1 AND stato = 'approved'
     AND EXTRACT(YEAR FROM data_inizio) = $2`,
    [userId, anno]
  );
  const usati = parseFloat(consumati.rows[0].giorni);

  const pendenti = await db.query(
    `SELECT COALESCE(SUM(giorni_totali), 0)::numeric AS giorni
     FROM ferie WHERE user_id = $1 AND stato = 'pending'
     AND EXTRACT(YEAR FROM data_inizio) = $2`,
    [userId, anno]
  );
  const inAttesa = parseFloat(pendenti.rows[0].giorni);

  return {
    anno,
    giorni_spettanti: spettanti,
    giorni_usati: usati,
    giorni_pendenti: inAttesa,
    giorni_residui: spettanti - usati,
    budget_configurato: !!budget
  };
}

/**
 * Crea o aggiorna il budget ferie per un utente/anno.
 */
async function setBudgetUtente(userId, anno, giorniSpettanti, giorniAggiuntivi, note) {
  const r = await db.query(
    `INSERT INTO budget_ferie (user_id, anno, giorni_spettanti, giorni_aggiuntivi, note)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, anno) DO UPDATE SET
       giorni_spettanti = $3, giorni_aggiuntivi = $4, note = $5, updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [userId, anno, giorniSpettanti, giorniAggiuntivi || 0, note || null]
  );
  return r.rows[0];
}

/**
 * Inizializza il budget per tutti gli utenti attivi per un anno.
 */
async function initBudgetAnno(anno, giorniDefault) {
  const users = await db.query('SELECT id FROM users WHERE is_active = true');
  let count = 0;
  for (const u of users.rows) {
    const exists = await db.query(
      'SELECT id FROM budget_ferie WHERE user_id = $1 AND anno = $2',
      [u.id, anno]
    );
    if (exists.rows.length === 0) {
      await setBudgetUtente(u.id, anno, giorniDefault, 0, 'Inizializzazione automatica');
      count++;
    }
  }
  return count;
}

/**
 * Recupera il budget per tutti gli utenti per un anno (admin view).
 */
async function getBudgetTutti(anno) {
  const r = await db.query(
    `SELECT u.id AS user_id, u.username, u.full_name, u.tipo_contratto,
            r.nome AS reparto_nome,
            b.giorni_spettanti, b.giorni_aggiuntivi, b.note,
            COALESCE((SELECT SUM(f.giorni_totali) FROM ferie f WHERE f.user_id = u.id AND f.stato = 'approved' AND EXTRACT(YEAR FROM f.data_inizio) = $1), 0)::numeric AS giorni_usati,
            COALESCE((SELECT SUM(f.giorni_totali) FROM ferie f WHERE f.user_id = u.id AND f.stato = 'pending' AND EXTRACT(YEAR FROM f.data_inizio) = $1), 0)::numeric AS giorni_pendenti
     FROM users u
     LEFT JOIN budget_ferie b ON b.user_id = u.id AND b.anno = $1
     LEFT JOIN reparti r ON r.id = u.reparto_id
     WHERE u.is_active = true
     ORDER BY u.full_name`,
    [anno]
  );
  return r.rows.map(row => ({
    ...row,
    giorni_spettanti: parseFloat(row.giorni_spettanti || 0),
    giorni_aggiuntivi: parseFloat(row.giorni_aggiuntivi || 0),
    giorni_usati: parseFloat(row.giorni_usati),
    giorni_pendenti: parseFloat(row.giorni_pendenti),
    giorni_residui: parseFloat(row.giorni_spettanti || 0) + parseFloat(row.giorni_aggiuntivi || 0) - parseFloat(row.giorni_usati)
  }));
}

module.exports = {
  getBudgetUtente,
  getSaldoFerie,
  setBudgetUtente,
  initBudgetAnno,
  getBudgetTutti
};
