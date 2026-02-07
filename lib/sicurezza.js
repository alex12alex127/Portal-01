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

// ===== INFORTUNI =====
async function getInfortuni(filtri = {}) {
  let where = '';
  const params = [];
  let n = 1;
  if (filtri.user_id) {
    where += ' WHERE i.user_id = $' + n;
    params.push(filtri.user_id);
    n++;
  }
  if (filtri.stato) {
    where += (where ? ' AND' : ' WHERE') + ' i.stato = $' + n;
    params.push(filtri.stato);
    n++;
  }
  if (filtri.anno) {
    where += (where ? ' AND' : ' WHERE') + ' EXTRACT(YEAR FROM i.data_evento) = $' + n;
    params.push(filtri.anno);
    n++;
  }
  const result = await db.query(
    'SELECT i.*, u.full_name, u.username FROM infortuni i JOIN users u ON u.id = i.user_id' + where + ' ORDER BY i.data_evento DESC',
    params
  );
  return result.rows;
}

async function getInfortunio(id) {
  const result = await db.query(
    'SELECT i.*, u.full_name, u.username FROM infortuni i JOIN users u ON u.id = i.user_id WHERE i.id = $1',
    [id]
  );
  return result.rows[0] || null;
}

async function creaInfortunio(data) {
  const result = await db.query(
    `INSERT INTO infortuni (user_id, data_evento, ora_evento, luogo, descrizione, tipo_lesione, parte_corpo, giorni_prognosi, data_rientro, testimoni, provvedimenti, denunciato_inail, numero_pratica, stato, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
    [data.user_id, data.data_evento, data.ora_evento || null, data.luogo || null, data.descrizione, data.tipo_lesione || null, data.parte_corpo || null, data.giorni_prognosi || 0, data.data_rientro || null, data.testimoni || null, data.provvedimenti || null, data.denunciato_inail || false, data.numero_pratica || null, data.stato || 'aperto', data.created_by || null]
  );
  return result.rows[0];
}

async function aggiornaInfortunio(id, data) {
  const result = await db.query(
    `UPDATE infortuni SET data_evento = $2, ora_evento = $3, luogo = $4, descrizione = $5, tipo_lesione = $6, parte_corpo = $7, giorni_prognosi = $8, data_rientro = $9, testimoni = $10, provvedimenti = $11, denunciato_inail = $12, numero_pratica = $13, stato = $14, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
    [id, data.data_evento, data.ora_evento || null, data.luogo || null, data.descrizione, data.tipo_lesione || null, data.parte_corpo || null, data.giorni_prognosi || 0, data.data_rientro || null, data.testimoni || null, data.provvedimenti || null, data.denunciato_inail || false, data.numero_pratica || null, data.stato || 'aperto']
  );
  return result.rows[0] || null;
}

async function eliminaInfortunio(id) {
  const result = await db.query('DELETE FROM infortuni WHERE id = $1 RETURNING id', [id]);
  return result.rows[0] || null;
}

// ===== DOCUMENTI SICUREZZA =====
async function getDocumentiSicurezza(filtri = {}) {
  let where = '';
  const params = [];
  let n = 1;
  if (filtri.categoria) {
    where += ' WHERE ds.categoria = $' + n;
    params.push(filtri.categoria);
    n++;
  }
  const result = await db.query(
    'SELECT ds.*, u.full_name AS autore_nome FROM documenti_sicurezza ds LEFT JOIN users u ON u.id = ds.created_by' + where + ' ORDER BY ds.categoria, ds.titolo',
    params
  );
  return result.rows;
}

async function getDocumentoSicurezza(id) {
  const result = await db.query(
    'SELECT ds.*, u.full_name AS autore_nome FROM documenti_sicurezza ds LEFT JOIN users u ON u.id = ds.created_by WHERE ds.id = $1',
    [id]
  );
  return result.rows[0] || null;
}

async function creaDocumentoSicurezza(data) {
  const result = await db.query(
    `INSERT INTO documenti_sicurezza (titolo, categoria, descrizione, versione, data_approvazione, data_scadenza, file_path, file_nome, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [data.titolo, data.categoria, data.descrizione || null, data.versione || '1.0', data.data_approvazione || null, data.data_scadenza || null, data.file_path || null, data.file_nome || null, data.created_by || null]
  );
  return result.rows[0];
}

async function aggiornaDocumentoSicurezza(id, data) {
  const result = await db.query(
    `UPDATE documenti_sicurezza SET titolo = $2, categoria = $3, descrizione = $4, versione = $5, data_approvazione = $6, data_scadenza = $7, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
    [id, data.titolo, data.categoria, data.descrizione || null, data.versione || '1.0', data.data_approvazione || null, data.data_scadenza || null]
  );
  return result.rows[0] || null;
}

async function eliminaDocumentoSicurezza(id) {
  const result = await db.query('DELETE FROM documenti_sicurezza WHERE id = $1 RETURNING id', [id]);
  return result.rows[0] || null;
}

// ===== STATISTICHE / SCADENZE =====
async function getScadenzeSicurezza(giorniAvanti = 30) {
  const [formScad, dpiScad, docScad] = await Promise.all([
    db.query(
      `SELECT f.id, f.tipo, f.data_scadenza, u.full_name, u.username, 'formazione' AS categoria
       FROM formazioni f JOIN users u ON u.id = f.user_id
       WHERE f.data_scadenza <= (CURRENT_DATE + $1 * INTERVAL '1 day') AND f.stato = 'valido'
       ORDER BY f.data_scadenza ASC`, [giorniAvanti]
    ),
    db.query(
      `SELECT d.id, d.tipo_dpi AS tipo, d.data_scadenza, u.full_name, u.username, 'dpi' AS categoria
       FROM dpi_consegne d JOIN users u ON u.id = d.user_id
       WHERE d.data_scadenza <= (CURRENT_DATE + $1 * INTERVAL '1 day') AND d.stato = 'consegnato'
       ORDER BY d.data_scadenza ASC`, [giorniAvanti]
    ),
    db.query(
      `SELECT ds.id, ds.titolo AS tipo, ds.data_scadenza, ds.categoria, 'documento' AS categoria_tipo
       FROM documenti_sicurezza ds
       WHERE ds.data_scadenza <= (CURRENT_DATE + $1 * INTERVAL '1 day')
       ORDER BY ds.data_scadenza ASC`, [giorniAvanti]
    )
  ]);
  return {
    formazioni: formScad.rows,
    dpi: dpiScad.rows,
    documenti: docScad.rows,
    totale: formScad.rows.length + dpiScad.rows.length + docScad.rows.length
  };
}

async function getStatisticheSicurezza() {
  const [formTot, formScad, dpiTot, dpiScad, infTot, infAnno, docTot] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS n FROM formazioni WHERE stato = \'valido\''),
    db.query('SELECT COUNT(*)::int AS n FROM formazioni WHERE data_scadenza < CURRENT_DATE AND stato = \'valido\''),
    db.query('SELECT COUNT(*)::int AS n FROM dpi_consegne WHERE stato = \'consegnato\''),
    db.query('SELECT COUNT(*)::int AS n FROM dpi_consegne WHERE data_scadenza < CURRENT_DATE AND stato = \'consegnato\''),
    db.query('SELECT COUNT(*)::int AS n FROM infortuni'),
    db.query('SELECT COUNT(*)::int AS n FROM infortuni WHERE EXTRACT(YEAR FROM data_evento) = $1', [new Date().getFullYear()]),
    db.query('SELECT COUNT(*)::int AS n FROM documenti_sicurezza')
  ]);
  return {
    formazioni_attive: formTot.rows[0].n,
    formazioni_scadute: formScad.rows[0].n,
    dpi_attivi: dpiTot.rows[0].n,
    dpi_scaduti: dpiScad.rows[0].n,
    infortuni_totali: infTot.rows[0].n,
    infortuni_anno: infAnno.rows[0].n,
    documenti: docTot.rows[0].n
  };
}

module.exports = {
  getFormazioni, getFormazione, creaFormazione, aggiornaFormazione, eliminaFormazione,
  getDpiConsegne, getDpiConsegna, creaDpiConsegna, aggiornaDpiConsegna, eliminaDpiConsegna,
  getInfortuni, getInfortunio, creaInfortunio, aggiornaInfortunio, eliminaInfortunio,
  getDocumentiSicurezza, getDocumentoSicurezza, creaDocumentoSicurezza, aggiornaDocumentoSicurezza, eliminaDocumentoSicurezza,
  getScadenzeSicurezza, getStatisticheSicurezza
};
