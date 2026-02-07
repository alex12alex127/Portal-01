const db = require('../config/database');

/**
 * Restituisce tutte le festività per un anno specifico.
 * Per le ricorrenti, confronta mese e giorno; per le non-ricorrenti, l'anno esatto.
 */
async function getFestivitaAnno(anno) {
  const result = await db.query(
    `SELECT id, nome, data, ricorrente, note, created_by, created_at
     FROM festivita
     WHERE (ricorrente = true AND EXTRACT(YEAR FROM data) <= $1)
        OR (ricorrente = false AND EXTRACT(YEAR FROM data) = $1)
     ORDER BY EXTRACT(MONTH FROM data), EXTRACT(DAY FROM data)`,
    [anno]
  );
  return result.rows.map(r => ({
    ...r,
    data: typeof r.data === 'string' ? r.data.slice(0, 10) : r.data.toISOString().slice(0, 10)
  }));
}

/**
 * Restituisce tutte le festività (per admin).
 */
async function getAllFestivita() {
  const result = await db.query(
    `SELECT f.id, f.nome, f.data, f.ricorrente, f.note, f.created_by, f.created_at, u.full_name AS creato_da_nome
     FROM festivita f
     LEFT JOIN users u ON u.id = f.created_by
     ORDER BY f.data DESC`
  );
  return result.rows.map(r => ({
    ...r,
    data: typeof r.data === 'string' ? r.data.slice(0, 10) : r.data.toISOString().slice(0, 10)
  }));
}

/**
 * Crea una nuova festività.
 */
async function creaFestivita({ nome, data, ricorrente, note, created_by }) {
  const result = await db.query(
    `INSERT INTO festivita (nome, data, ricorrente, note, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [nome, data, ricorrente || false, note || null, created_by || null]
  );
  return result.rows[0];
}

/**
 * Aggiorna una festività esistente.
 */
async function aggiornaFestivita(id, { nome, data, ricorrente, note }) {
  const result = await db.query(
    `UPDATE festivita SET nome = $1, data = $2, ricorrente = $3, note = $4, updated_at = CURRENT_TIMESTAMP
     WHERE id = $5 RETURNING id`,
    [nome, data, ricorrente || false, note || null, id]
  );
  return result.rows[0];
}

/**
 * Elimina una festività.
 */
async function eliminaFestivita(id) {
  const result = await db.query('DELETE FROM festivita WHERE id = $1 RETURNING id', [id]);
  return result.rows[0];
}

/**
 * Restituisce un Set di date festive (formato 'YYYY-MM-DD') per un anno.
 * Per le ricorrenti, proietta sul anno richiesto.
 */
async function getDateFestiveAnno(anno) {
  const festivita = await getFestivitaAnno(anno);
  const set = new Set();
  for (const f of festivita) {
    if (f.ricorrente) {
      // Prendi mese-giorno dalla data originale, proietta sull'anno richiesto
      const md = f.data.slice(5); // 'MM-DD'
      set.add(anno + '-' + md);
    } else {
      set.add(f.data);
    }
  }
  return set;
}

/**
 * Calcola i giorni lavorativi tra due date, escludendo weekend e festività aziendali.
 * @param {string} dataInizio - 'YYYY-MM-DD'
 * @param {string} dataFine - 'YYYY-MM-DD'
 * @returns {number} giorni lavorativi
 */
async function calcolaGiorniLavorativi(dataInizio, dataFine) {
  const [sy, sm, sd] = dataInizio.split('-').map(Number);
  const [ey, em, ed] = dataFine.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  // Raccogli festività per tutti gli anni coinvolti
  const anniCoinvolti = new Set();
  for (let d = new Date(start); d <= end; d.setFullYear(d.getFullYear() + 1)) {
    anniCoinvolti.add(d.getFullYear());
  }
  // Assicurati di includere l'anno della fine
  anniCoinvolti.add(end.getFullYear());

  const tutteFestive = new Set();
  for (const anno of anniCoinvolti) {
    const festive = await getDateFestiveAnno(anno);
    for (const d of festive) tutteFestive.add(d);
  }

  let count = 0;
  for (let d = new Date(start.getTime()); d <= end; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day === 0 || day === 6) continue; // weekend
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (tutteFestive.has(key)) continue; // festività
    count++;
  }
  return count;
}

/**
 * Inserisce le festività italiane standard per un anno.
 */
async function inserisciFestivitaItaliane(anno, userId) {
  const feste = [
    { nome: 'Capodanno', mese: 1, giorno: 1 },
    { nome: 'Epifania', mese: 1, giorno: 6 },
    { nome: 'Festa della Liberazione', mese: 4, giorno: 25 },
    { nome: 'Festa del Lavoro', mese: 5, giorno: 1 },
    { nome: 'Festa della Repubblica', mese: 6, giorno: 2 },
    { nome: 'Ferragosto', mese: 8, giorno: 15 },
    { nome: 'Tutti i Santi', mese: 11, giorno: 1 },
    { nome: 'Immacolata Concezione', mese: 12, giorno: 8 },
    { nome: 'Natale', mese: 12, giorno: 25 },
    { nome: 'Santo Stefano', mese: 12, giorno: 26 },
  ];
  const inserite = [];
  for (const f of feste) {
    const data = anno + '-' + String(f.mese).padStart(2, '0') + '-' + String(f.giorno).padStart(2, '0');
    // Controlla se esiste già
    const exists = await db.query(
      `SELECT id FROM festivita WHERE EXTRACT(MONTH FROM data) = $1 AND EXTRACT(DAY FROM data) = $2 AND ricorrente = true`,
      [f.mese, f.giorno]
    );
    if (exists.rows.length === 0) {
      const r = await creaFestivita({ nome: f.nome, data, ricorrente: true, note: 'Festività nazionale', created_by: userId });
      inserite.push(r);
    }
  }
  return inserite;
}

module.exports = {
  getFestivitaAnno,
  getAllFestivita,
  creaFestivita,
  aggiornaFestivita,
  eliminaFestivita,
  getDateFestiveAnno,
  calcolaGiorniLavorativi,
  inserisciFestivitaItaliane
};
