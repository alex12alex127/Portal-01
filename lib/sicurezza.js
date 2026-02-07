const db = require('../config/database');

// ===== FORMAZIONI =====
async function getFormazioni(filtri = {}) {
  let where = '';
  const params = [];
  let n = 1;
  if (filtri.user_id) {
    where += ' WHERE f.user_id = $' + n;
    params.push(filtri.user_id);
    n++;
  }
  if (filtri.stato) {
    where += (where ? ' AND' : ' WHERE') + ' f.stato = $' + n;
    params.push(filtri.stato);
    n++;
  }
  if (filtri.scadute) {
    where += (where ? ' AND' : ' WHERE') + ' f.data_scadenza < CURRENT_DATE AND f.stato = \'valido\'';
  }
  if (filtri.in_scadenza_giorni) {
    where += (where ? ' AND' : ' WHERE') + ' f.data_scadenza BETWEEN CURRENT_DATE AND (CURRENT_DATE + $' + n + ' * INTERVAL \'1 day\') AND f.stato = \'valido\'';
    params.push(filtri.in_scadenza_giorni);
    n++;
  }
  const result = await db.query(
    'SELECT f.*, u.full_name, u.username FROM formazioni f JOIN users u ON u.id = f.user_id' + where + ' ORDER BY f.data_scadenza ASC NULLS LAST, f.data_corso DESC',
    params
  );
  return result.rows;
}

async function getFormazione(id) {
  const result = await db.query(
    'SELECT f.*, u.full_name, u.username FROM formazioni f JOIN users u ON u.id = f.user_id WHERE f.id = $1',
    [id]
  );
  return result.rows[0] || null;
}

async function creaFormazione(data) {
  const result = await db.query(
    `INSERT INTO formazioni (user_id, tipo, descrizione, ente_formatore, data_corso, data_scadenza, ore, attestato_path, attestato_nome, stato, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [data.user_id, data.tipo, data.descrizione || null, data.ente_formatore || null, data.data_corso, data.data_scadenza || null, data.ore || null, data.attestato_path || null, data.attestato_nome || null, data.stato || 'valido', data.created_by || null]
  );
  return result.rows[0];
}

async function aggiornaFormazione(id, data) {
  const result = await db.query(
    `UPDATE formazioni SET tipo = $2, descrizione = $3, ente_formatore = $4, data_corso = $5, data_scadenza = $6, ore = $7, stato = $8, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
    [id, data.tipo, data.descrizione || null, data.ente_formatore || null, data.data_corso, data.data_scadenza || null, data.ore || null, data.stato || 'valido']
  );
  return result.rows[0] || null;
}

async function eliminaFormazione(id) {
  const result = await db.query('DELETE FROM formazioni WHERE id = $1 RETURNING id', [id]);
  return result.rows[0] || null;
}

// ===== DPI =====
async function getDpiConsegne(filtri = {}) {
  let where = '';
  const params = [];
  let n = 1;
  if (filtri.user_id) {
    where += ' WHERE d.user_id = $' + n;
    params.push(filtri.user_id);
    n++;
  }
  if (filtri.stato) {
    where += (where ? ' AND' : ' WHERE') + ' d.stato = $' + n;
    params.push(filtri.stato);
    n++;
  }
  if (filtri.scaduti) {
    where += (where ? ' AND' : ' WHERE') + ' d.data_scadenza < CURRENT_DATE AND d.stato = \'consegnato\'';
  }
  if (filtri.in_scadenza_giorni) {
    where += (where ? ' AND' : ' WHERE') + ' d.data_scadenza BETWEEN CURRENT_DATE AND (CURRENT_DATE + $' + n + ' * INTERVAL \'1 day\') AND d.stato = \'consegnato\'';
    params.push(filtri.in_scadenza_giorni);
    n++;
  }
  const result = await db.query(
    'SELECT d.*, u.full_name, u.username FROM dpi_consegne d JOIN users u ON u.id = d.user_id' + where + ' ORDER BY d.data_scadenza ASC NULLS LAST, d.data_consegna DESC',
    params
  );
  return result.rows;
}

async function getDpiConsegna(id) {
  const result = await db.query(
    'SELECT d.*, u.full_name, u.username FROM dpi_consegne d JOIN users u ON u.id = d.user_id WHERE d.id = $1',
    [id]
  );
  return result.rows[0] || null;
}

async function creaDpiConsegna(data) {
  const result = await db.query(
    `INSERT INTO dpi_consegne (user_id, tipo_dpi, descrizione, taglia, quantita, data_consegna, data_scadenza, lotto, stato, note, consegnato_da)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [data.user_id, data.tipo_dpi, data.descrizione || null, data.taglia || null, data.quantita || 1, data.data_consegna, data.data_scadenza || null, data.lotto || null, data.stato || 'consegnato', data.note || null, data.consegnato_da || null]
  );
  return result.rows[0];
}

async function aggiornaDpiConsegna(id, data) {
  const result = await db.query(
    `UPDATE dpi_consegne SET tipo_dpi = $2, descrizione = $3, taglia = $4, quantita = $5, data_consegna = $6, data_scadenza = $7, lotto = $8, stato = $9, note = $10, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
    [id, data.tipo_dpi, data.descrizione || null, data.taglia || null, data.quantita || 1, data.data_consegna, data.data_scadenza || null, data.lotto || null, data.stato || 'consegnato', data.note || null]
  );
  return result.rows[0] || null;
}

async function eliminaDpiConsegna(id) {
  const result = await db.query('DELETE FROM dpi_consegne WHERE id = $1 RETURNING id', [id]);
  return result.rows[0] || null;
}

// ===== STATISTICHE / SCADENZE =====
async function getScadenzeSicurezza(giorniAvanti = 30) {
  const [formScad, dpiScad] = await Promise.all([
    db.query(
      `SELECT f.id, f.user_id, f.tipo, f.data_scadenza, u.full_name, u.username, 'formazione' AS categoria
       FROM formazioni f JOIN users u ON u.id = f.user_id
       WHERE f.data_scadenza <= (CURRENT_DATE + $1 * INTERVAL '1 day') AND f.stato = 'valido'
       ORDER BY f.data_scadenza ASC`, [giorniAvanti]
    ),
    db.query(
      `SELECT d.id, d.user_id, d.tipo_dpi AS tipo, d.data_scadenza, u.full_name, u.username, 'dpi' AS categoria
       FROM dpi_consegne d JOIN users u ON u.id = d.user_id
       WHERE d.data_scadenza <= (CURRENT_DATE + $1 * INTERVAL '1 day') AND d.stato = 'consegnato'
       ORDER BY d.data_scadenza ASC`, [giorniAvanti]
    )
  ]);
  return {
    formazioni: formScad.rows,
    dpi: dpiScad.rows,
    totale: formScad.rows.length + dpiScad.rows.length
  };
}

async function getStatisticheSicurezza() {
  const [formTot, formScad, dpiTot, dpiScad] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS n FROM formazioni WHERE stato = \'valido\''),
    db.query('SELECT COUNT(*)::int AS n FROM formazioni WHERE data_scadenza < CURRENT_DATE AND stato = \'valido\''),
    db.query('SELECT COUNT(*)::int AS n FROM dpi_consegne WHERE stato = \'consegnato\''),
    db.query('SELECT COUNT(*)::int AS n FROM dpi_consegne WHERE data_scadenza < CURRENT_DATE AND stato = \'consegnato\'')
  ]);
  return {
    formazioni_attive: formTot.rows[0].n,
    formazioni_scadute: formScad.rows[0].n,
    dpi_attivi: dpiTot.rows[0].n,
    dpi_scaduti: dpiScad.rows[0].n
  };
}

module.exports = {
  getFormazioni, getFormazione, creaFormazione, aggiornaFormazione, eliminaFormazione,
  getDpiConsegne, getDpiConsegna, creaDpiConsegna, aggiornaDpiConsegna, eliminaDpiConsegna,
  getScadenzeSicurezza, getStatisticheSicurezza
};
