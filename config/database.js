const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('ATTENZIONE: DATABASE_URL non è impostata. Configura la variabile d\'ambiente.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000
});

const initDatabase = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL non configurata. Imposta la variabile d\'ambiente.');
  }
  const client = await pool.connect();
  try {
    console.log('Initializing database...');
    
    // Create users table
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
    console.log('✓ Users table ready');

    // Create ferie table
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
    console.log('✓ Ferie table ready');

    console.log('✓ Database initialized successfully');
    console.log('ℹ️  Run "npm run create-admin" to create default admin users');
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  initDatabase
};
