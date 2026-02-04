require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('Imposta DATABASE_URL');
    process.exit(1);
  }
  const client = await pool.connect();
  try {
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP');
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await client.query('UPDATE users SET is_active = true WHERE is_active IS NULL');
    console.log('Migrazione completata');
  } catch (err) {
    console.error('Errore:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
