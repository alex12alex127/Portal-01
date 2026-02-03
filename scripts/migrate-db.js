require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrateDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database migration...\n');
    
    // Aggiungi colonna is_active se non esiste
    console.log('Adding is_active column...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true
    `);
    console.log('✓ is_active column added\n');
    
    // Aggiungi colonna last_login se non esiste
    console.log('Adding last_login column...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMP
    `);
    console.log('✓ last_login column added\n');
    
    // Aggiungi colonna updated_at se non esiste
    console.log('Adding updated_at column...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    console.log('✓ updated_at column added\n');
    
    // Imposta is_active = true per tutti gli utenti esistenti
    console.log('Setting is_active = true for existing users...');
    await client.query(`
      UPDATE users SET is_active = true WHERE is_active IS NULL
    `);
    console.log('✓ Updated existing users\n');
    
    console.log('✅ Database migration completed successfully!');
    
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateDatabase();
