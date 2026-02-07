const db = require('../config/database');

async function creaAvviso(titolo, contenuto, tipo = 'info', opzioni = {}) {
  try {
    const { in_evidenza = false, visibile_da = null, visibile_fino = null, created_by = null } = opzioni;
    
    const result = await db.query(`
      INSERT INTO avvisi (titolo, contenuto, tipo, in_evidenza, visibile_da, visibile_fino, created_by) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING id, created_at
    `, [titolo, contenuto, tipo, in_evidenza, visibile_da, visibile_fino, created_by]);
    
    return result.rows[0];
  } catch (err) {
    console.error('[avvisi create]', err.message);
    throw err;
  }
}

async function getAvvisiVisibili(userId = null) {
  try {
    const oggi = new Date().toISOString().split('T')[0];
    
    let query = `
      SELECT a.*, u.full_name as autore_nome,
             CASE WHEN al.user_id IS NOT NULL THEN true ELSE false END as letto
      FROM avvisi a
      LEFT JOIN users u ON a.created_by = u.id
      LEFT JOIN avvisi_letti al ON a.id = al.avviso_id AND al.user_id = $1
      WHERE (a.visibile_da IS NULL OR a.visibile_da <= $2) 
        AND (a.visibile_fino IS NULL OR a.visibile_fino >= $2)
      ORDER BY a.in_evidenza DESC, a.created_at DESC
    `;
    
    const params = userId ? [userId, oggi] : [null, oggi];
    const result = await db.query(query, params);
    
    return result.rows;
  } catch (err) {
    console.error('[avvisi get]', err.message);
    return [];
  }
}

async function getAvviso(id) {
  try {
    const result = await db.query(`
      SELECT a.*, u.full_name as autore_nome
      FROM avvisi a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.id = $1
    `, [id]);
    
    return result.rows[0] || null;
  } catch (err) {
    console.error('[avvisi get one]', err.message);
    return null;
  }
}

async function aggiornaAvviso(id, dati) {
  try {
    const { titolo, contenuto, tipo, in_evidenza, visibile_da, visibile_fino } = dati;
    
    const result = await db.query(`
      UPDATE avvisi 
      SET titolo = $1, contenuto = $2, tipo = $3, in_evidenza = $4, 
          visibile_da = $5, visibile_fino = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `, [titolo, contenuto, tipo, in_evidenza, visibile_da, visibile_fino, id]);
    
    return result.rows[0];
  } catch (err) {
    console.error('[avvisi update]', err.message);
    throw err;
  }
}

async function eliminaAvviso(id) {
  try {
    await db.query('DELETE FROM avvisi WHERE id = $1', [id]);
    return true;
  } catch (err) {
    console.error('[avvisi delete]', err.message);
    throw err;
  }
}

async function marcaAvvisoComeLetto(avvisoId, userId) {
  try {
    await db.query(`
      INSERT INTO avvisi_letti (user_id, avviso_id) 
      VALUES ($1, $2) 
      ON CONFLICT (user_id, avviso_id) DO NOTHING
    `, [userId, avvisoId]);
  } catch (err) {
    console.error('[avvisi read]', err.message);
  }
}

async function contaAvvisiNonLetti(userId) {
  try {
    const oggi = new Date().toISOString().split('T')[0];
    
    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM avvisi a
      LEFT JOIN avvisi_letti al ON a.id = al.avviso_id AND al.user_id = $1
      WHERE (a.visibile_da IS NULL OR a.visibile_da <= $2) 
        AND (a.visibile_fino IS NULL OR a.visibile_fino >= $2)
        AND al.user_id IS NULL
    `, [userId, oggi]);
    
    return parseInt(result.rows[0].count);
  } catch (err) {
    console.error('[avvisi count]', err.message);
    return 0;
  }
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
