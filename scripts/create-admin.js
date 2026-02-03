require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createAdminUsers() {
  const client = await pool.connect();
  
  try {
    console.log('Creating admin users...\n');
    
    // Admin principale
    const adminPassword = await bcrypt.hash('Admin123!', 12);
    await client.query(`
      INSERT INTO users (username, email, password, full_name, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (username) DO UPDATE 
      SET password = $3, role = $5, is_active = $6
    `, ['admin', 'admin@portal01.com', adminPassword, 'Amministratore', 'admin', true]);
    console.log('✓ Admin created:');
    console.log('  Username: admin');
    console.log('  Password: Admin123!');
    console.log('  Role: admin\n');
    
    // Manager
    const managerPassword = await bcrypt.hash('Manager123!', 12);
    await client.query(`
      INSERT INTO users (username, email, password, full_name, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (username) DO UPDATE 
      SET password = $3, role = $5, is_active = $6
    `, ['manager', 'manager@portal01.com', managerPassword, 'Manager', 'manager', true]);
    console.log('✓ Manager created:');
    console.log('  Username: manager');
    console.log('  Password: Manager123!');
    console.log('  Role: manager\n');
    
    // User di test
    const userPassword = await bcrypt.hash('User123!', 12);
    await client.query(`
      INSERT INTO users (username, email, password, full_name, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (username) DO UPDATE 
      SET password = $3, role = $5, is_active = $6
    `, ['user', 'user@portal01.com', userPassword, 'Utente Test', 'user', true]);
    console.log('✓ User created:');
    console.log('  Username: user');
    console.log('  Password: User123!');
    console.log('  Role: user\n');
    
    console.log('✅ All users created successfully!');
    console.log('\n⚠️  IMPORTANTE: Cambia queste password in produzione!\n');
    
  } catch (err) {
    console.error('❌ Error creating users:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createAdminUsers();
