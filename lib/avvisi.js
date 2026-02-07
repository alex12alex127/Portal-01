const db = require('../config/database');

async function creaAvviso(titolo, contenuto, tipo, options = {}) {
  const result = await db.query(
    `INSERT INTO avvisi (titolo, contenuto, tipo, in_evidenza, visibile_da, visibile_fino, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
    [titolo, contenuto, tipo || 'info', options.in_evidenza || false, options.visibile_da || null, options.visibile_fino || null, options.created_by || null]
  );
  return result.rows[0];
}

async function getAvvisiVisibili(userId) {
  const result = await db.query(
    `SELECT a.*, u.full_name AS autore_nome,
            CASE WHEN al.user_id IS NOT NULL THEN true ELSE false END AS letto
     FROM avvisi a
     LEFT JOIN users u ON a.created_by = u.id
     LEFT JOIN avvisi_letti al ON a.id = al.avviso_id AND al.user_id = $1
     WHERE (a.visibile_da IS NULL OR a.visibile_da <= CURRENT_DATE)
       AND (a.visibile_fino IS NULL OR a.visibile_fino >= CURRENT_DATE)
     ORDER BY a.in_evidenza DESC, a.created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function getAvviso(id) {
  const result = await db.query(
    `SELECT a.*, u.full_name AS autore_nome
     FROM avvisi a
     LEFT JOIN users u ON a.created_by = u.id
     WHERE a.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function aggiornaAvviso(id, data) {
  const result = await db.query(
    `UPDATE avvisi
     SET titolo = $2, contenuto = $3, tipo = $4, in_evidenza = $5,
         visibile_da = $6, visibile_fino = $7, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, data.titolo, data.contenuto, data.tipo || 'info', data.in_evidenza || false, data.visibile_da || null, data.visibile_fino || null]
  );
  if (result.rows.length === 0) throw new Error('Avviso non trovato');
  return result.rows[0];
}

async function eliminaAvviso(id) {
  const result = await db.query('DELETE FROM avvisi WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) throw new Error('Avviso non trovato');
  return result.rows[0];
}

async function marcaAvvisoComeLetto(avvisoId, userId) {
  await db.query(
    `INSERT INTO avvisi_letti (avviso_id, user_id, letto_il)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, avviso_id) DO UPDATE SET letto_il = NOW()`,
    [avvisoId, userId]
  );
  return true;
}

async function contaAvvisiNonLetti(userId) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS count FROM avvisi a
     WHERE (a.visibile_da IS NULL OR a.visibile_da <= CURRENT_DATE)
       AND (a.visibile_fino IS NULL OR a.visibile_fino >= CURRENT_DATE)
       AND NOT EXISTS (SELECT 1 FROM avvisi_letti al WHERE al.avviso_id = a.id AND al.user_id = $1)`,
    [userId]
  );
  return result.rows[0].count;
}

module.exports = {
  creaAvviso,
  getAvvisiVisibili,
  getAvviso,
  aggiornaAvviso,
  eliminaAvviso,
  marcaAvvisoComeLetto,
  contaAvvisiNonLetti
};
