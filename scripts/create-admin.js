require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('Imposta DATABASE_URL nel file .env (vedi .env.example e DOKPLOY-POSTGRES.md)');
    process.exit(1);
  }
  const client = await pool.connect();
  try {
    const users = [
      { username: 'admin', email: 'admin@portal01.com', password: 'Admin123!', full_name: 'Amministratore', role: 'admin' },
      { username: 'manager', email: 'manager@portal01.com', password: 'Manager123!', full_name: 'Manager', role: 'manager' },
      { username: 'user', email: 'user@portal01.com', password: 'User123!', full_name: 'Utente Test', role: 'user' }
    ];
    for (const u of users) {
      const hash = await bcrypt.hash(u.password, 12);
      await client.query(
        `INSERT INTO users (username, email, password, full_name, role, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (username) DO UPDATE SET password = $3, role = $5, is_active = true`,
        [u.username, u.email, hash, u.full_name, u.role]
      );
      console.log('Ok:', u.username, '-', u.role);
    }
    console.log('Utenti di default creati. Login: admin / Admin123!');
  } catch (err) {
    console.error('Errore:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
