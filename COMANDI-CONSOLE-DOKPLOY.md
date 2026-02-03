# Comandi per Console Dokploy

## 🔧 Quando apri la Console su Dokploy

### 1. Vai nella directory corretta
```bash
cd /app
```

### 2. Verifica di essere nella directory giusta
```bash
pwd
# Dovrebbe mostrare: /app

ls
# Dovrebbe mostrare: server.js, package.json, etc.
```

### 3. Crea gli account admin
```bash
npm run create-admin
```

### 4. Verifica che gli account siano stati creati
```bash
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT username, role, is_active FROM users')
  .then(r => { console.log(r.rows); pool.end(); })
  .catch(e => { console.error(e); pool.end(); });
"
```

---

## 🐛 Se hai problemi

### Problema: "Cannot find module"
```bash
cd /app
npm install
npm run create-admin
```

### Problema: "Database connection error"
```bash
# Verifica variabili ambiente
echo $DATABASE_URL
echo $NODE_ENV

# Se DATABASE_URL è vuoto, le variabili non sono configurate
```

### Problema: "Permission denied"
```bash
# Dai permessi
chmod +x /app/scripts/create-admin.js
node /app/scripts/create-admin.js
```

---

## 📋 Comandi Utili

### Vedere i log dell'app
```bash
cd /app
npm start
# Ctrl+C per uscire
```

### Testare connessione database
```bash
cd /app
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()')
  .then(r => { console.log('✓ Database connected:', r.rows[0]); pool.end(); })
  .catch(e => { console.error('✗ Database error:', e.message); pool.end(); });
"
```

### Vedere struttura database
```bash
cd /app
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT table_name FROM information_schema.tables WHERE table_schema = \\'public\\'')
  .then(r => { console.log('Tables:', r.rows); pool.end(); })
  .catch(e => { console.error(e); pool.end(); });
"
```

### Reset password admin manualmente
```bash
cd /app
node -e "
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
bcrypt.hash('Admin123!', 12).then(hash => {
  pool.query('UPDATE users SET password = \$1 WHERE username = \$2', [hash, 'admin'])
    .then(() => { console.log('✓ Password reset'); pool.end(); })
    .catch(e => { console.error(e); pool.end(); });
});
"
```

---

## ✅ Sequenza Corretta

Quando apri la console Dokploy, esegui in ordine:

```bash
# 1. Vai nella directory app
cd /app

# 2. Verifica di essere nel posto giusto
ls -la

# 3. Crea admin
npm run create-admin

# 4. Verifica creazione
node -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query('SELECT username,role FROM users').then(r=>{console.log(r.rows);p.end()});"

# 5. Esci
exit
```

---

## 🚨 Errori Comuni

### Errore: "ENOENT: no such file or directory, open '/package.json'"
**Causa**: Sei nella directory root `/` invece di `/app`
**Soluzione**: `cd /app`

### Errore: "Cannot find module 'pg'"
**Causa**: Dipendenze non installate
**Soluzione**: `cd /app && npm install`

### Errore: "Connection refused"
**Causa**: DATABASE_URL non configurato o database non raggiungibile
**Soluzione**: Verifica variabili ambiente su Dokploy

---

## 💡 Tip

Puoi anche creare uno script personalizzato per semplificare:

```bash
cd /app
cat > setup.sh << 'EOF'
#!/bin/sh
cd /app
echo "Creating admin users..."
npm run create-admin
echo "Done!"
EOF

chmod +x setup.sh
./setup.sh
```
