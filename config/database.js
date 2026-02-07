const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL non impostata.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  max: process.env.NODE_ENV === 'production' ? 10 : undefined
});

async function initDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL obbligatoria. Vedi .env.example e DOKPLOY-POSTGRES.md');
  }
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ferie (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        data_inizio DATE NOT NULL,
        data_fine DATE NOT NULL,
        giorni_totali INTEGER NOT NULL,
        tipo VARCHAR(50) DEFAULT 'ferie',
        stato VARCHAR(20) DEFAULT 'pending',
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_ferie_user_id ON ferie(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_ferie_created_at ON ferie(created_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_ferie_stato ON ferie(stato)');
    await client.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR NOT NULL PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire)');
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifiche (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tipo VARCHAR(50) NOT NULL,
        titolo VARCHAR(255),
        messaggio TEXT,
        letta BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_notifiche_user_id ON notifiche(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_notifiche_letta ON notifiche(letta)');
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL UNIQUE,
        expire_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        azione VARCHAR(100) NOT NULL,
        dettaglio TEXT,
        ip VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC)');
    await client.query(`
      CREATE TABLE IF NOT EXISTS avvisi (
        id SERIAL PRIMARY KEY,
        titolo VARCHAR(255) NOT NULL,
        contenuto TEXT NOT NULL,
        tipo VARCHAR(50) DEFAULT 'info',
        in_evidenza BOOLEAN DEFAULT false,
        visibile_da DATE,
        visibile_fino DATE,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_avvisi_created_at ON avvisi(created_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_avvisi_tipo ON avvisi(tipo)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_avvisi_in_evidenza ON avvisi(in_evidenza) WHERE in_evidenza = true');
    await client.query(`
      CREATE TABLE IF NOT EXISTS avvisi_letti (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        avviso_id INTEGER NOT NULL REFERENCES avvisi(id) ON DELETE CASCADE,
        letto_il TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, avviso_id)
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_avvisi_letti_user ON avvisi_letti(user_id)');
    // Colonna commento_admin per motivo rifiuto/approvazione ferie
    await client.query('ALTER TABLE ferie ADD COLUMN IF NOT EXISTS commento_admin TEXT');
    // Colonna allegato per certificati medici
    await client.query('ALTER TABLE ferie ADD COLUMN IF NOT EXISTS allegato_path VARCHAR(500)');
    await client.query('ALTER TABLE ferie ADD COLUMN IF NOT EXISTS allegato_nome VARCHAR(255)');
    // Tabella impostazioni utente
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        lingua VARCHAR(10) DEFAULT 'it',
        tema VARCHAR(10) DEFAULT 'auto',
        notifiche_email BOOLEAN DEFAULT true,
        avatar_path VARCHAR(500),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Tabelle e indici create/verificate');
  } finally {
    client.release();
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  initDatabase
};
