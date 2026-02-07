const db = require('../config/database');

// Valori di default per le impostazioni
const DEFAULTS = {
  'azienda_nome': { valore: 'La Mia Azienda', tipo: 'text', categoria: 'generale', descrizione: 'Nome dell\'azienda' },
  'azienda_email': { valore: '', tipo: 'email', categoria: 'generale', descrizione: 'Email aziendale principale' },
  'azienda_telefono': { valore: '', tipo: 'text', categoria: 'generale', descrizione: 'Telefono aziendale' },
  'azienda_indirizzo': { valore: '', tipo: 'text', categoria: 'generale', descrizione: 'Indirizzo sede' },
  'azienda_piva': { valore: '', tipo: 'text', categoria: 'generale', descrizione: 'Partita IVA' },
  'ferie_giorni_default': { valore: '26', tipo: 'number', categoria: 'ferie', descrizione: 'Giorni ferie annuali di default' },
  'ferie_preavviso_giorni': { valore: '7', tipo: 'number', categoria: 'ferie', descrizione: 'Giorni minimi di preavviso per richiedere ferie' },
  'ferie_max_consecutivi': { valore: '15', tipo: 'number', categoria: 'ferie', descrizione: 'Massimo giorni ferie consecutivi' },
  'ferie_approvazione_auto': { valore: 'false', tipo: 'boolean', categoria: 'ferie', descrizione: 'Approvazione automatica (senza manager)' },
  'lavoro_giorni_settimana': { valore: '5', tipo: 'number', categoria: 'lavoro', descrizione: 'Giorni lavorativi a settimana (5=lun-ven, 6=lun-sab)' },
  'lavoro_ore_giornaliere': { valore: '8', tipo: 'number', categoria: 'lavoro', descrizione: 'Ore lavorative giornaliere standard' },
  'notifiche_email_attive': { valore: 'true', tipo: 'boolean', categoria: 'notifiche', descrizione: 'Invio email per notifiche' },
  'notifiche_email_hr': { valore: '', tipo: 'email', categoria: 'notifiche', descrizione: 'Email HR per notifiche admin' },
  'sicurezza_scadenza_alert_giorni': { valore: '30', tipo: 'number', categoria: 'sicurezza', descrizione: 'Giorni anticipo alert scadenze sicurezza' },
  'presenze_attive': { valore: 'true', tipo: 'boolean', categoria: 'moduli', descrizione: 'Abilita modulo presenze/timbrature' },
  'sicurezza_attiva': { valore: 'true', tipo: 'boolean', categoria: 'moduli', descrizione: 'Abilita modulo sicurezza sul lavoro' },
};

/**
 * Inizializza le impostazioni di default se non esistono.
 */
async function initImpostazioni() {
  for (const [chiave, def] of Object.entries(DEFAULTS)) {
    await db.query(
      `INSERT INTO impostazioni (chiave, valore, tipo, categoria, descrizione)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (chiave) DO NOTHING`,
      [chiave, def.valore, def.tipo, def.categoria, def.descrizione]
    );
  }
}

/**
 * Recupera un'impostazione per chiave.
 */
async function getImpostazione(chiave) {
  const r = await db.query('SELECT valore, tipo FROM impostazioni WHERE chiave = $1', [chiave]);
  if (r.rows.length === 0) {
    const def = DEFAULTS[chiave];
    return def ? def.valore : null;
  }
  const { valore, tipo } = r.rows[0];
  if (tipo === 'number') return parseFloat(valore) || 0;
  if (tipo === 'boolean') return valore === 'true';
  return valore;
}

/**
 * Recupera tutte le impostazioni, raggruppate per categoria.
 */
async function getAllImpostazioni() {
  const r = await db.query('SELECT chiave, valore, tipo, categoria, descrizione, updated_at FROM impostazioni ORDER BY categoria, chiave');
  const byCategoria = {};
  for (const row of r.rows) {
    if (!byCategoria[row.categoria]) byCategoria[row.categoria] = [];
    byCategoria[row.categoria].push(row);
  }
  return { rows: r.rows, byCategoria };
}

/**
 * Aggiorna un'impostazione.
 */
async function setImpostazione(chiave, valore) {
  await db.query(
    `INSERT INTO impostazioni (chiave, valore, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (chiave) DO UPDATE SET valore = $2, updated_at = CURRENT_TIMESTAMP`,
    [chiave, String(valore)]
  );
}

/**
 * Aggiorna più impostazioni in batch.
 */
async function setImpostazioniMultiple(updates) {
  for (const [chiave, valore] of Object.entries(updates)) {
    if (DEFAULTS[chiave] || chiave.startsWith('custom_')) {
      await setImpostazione(chiave, valore);
    }
  }
}

module.exports = {
  DEFAULTS,
  initImpostazioni,
  getImpostazione,
  getAllImpostazioni,
  setImpostazione,
  setImpostazioniMultiple
};
