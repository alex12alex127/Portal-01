# Risoluzione Problema Login

## 🔍 Problema Identificato

Dal log:
```
[2026-02-03T18:35:04.132Z] User found: admin, Active: undefined
[2026-02-03T18:35:04.227Z] Password valid: false
```

**Cause:**
1. La colonna `is_active` non esiste nel database (creato prima dell'aggiornamento)
2. La password nel database non corrisponde (probabilmente hashata con algoritmo diverso o non hashata)

## ✅ Soluzione

### Passo 1: Migra il Database
Aggiungi le colonne mancanti:
```bash
npm run migrate
```

Questo aggiunge:
- `is_active` (BOOLEAN)
- `last_login` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Passo 2: Ricrea gli Account Admin
Dopo la migrazione, ricrea gli account con le password corrette:
```bash
npm run create-admin
```

### Passo 3: Riavvia il Server
```bash
npm start
```

### Passo 4: Prova Login
Vai su http://localhost:3000 e usa:
- Username: `admin`
- Password: `Admin123!`

---

## 🔧 Soluzione Alternativa (Manuale)

Se gli script non funzionano, puoi fare manualmente:

### 1. Connettiti al Database
```bash
psql -U postgres -d portal_db
```

### 2. Aggiungi Colonne Mancanti
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
UPDATE users SET is_active = true WHERE is_active IS NULL;
```

### 3. Elimina Utenti Esistenti (Opzionale)
```sql
DELETE FROM users;
```

### 4. Esci da psql
```sql
\q
```

### 5. Ricrea Account
```bash
npm run create-admin
```

---

## 📋 Verifica Finale

Dopo aver eseguito i passaggi, verifica:

```bash
psql -U postgres -d portal_db
```

```sql
-- Verifica struttura tabella
\d users

-- Verifica utenti
SELECT username, role, is_active, created_at FROM users;

-- Esci
\q
```

Dovresti vedere:
- Colonna `is_active` presente
- Utente `admin` con `is_active = true`

---

## 🐛 Se Ancora Non Funziona

### Opzione 1: Reset Completo Database
```sql
DROP TABLE IF EXISTS ferie CASCADE;
DROP TABLE IF EXISTS users CASCADE;
```

Poi riavvia il server (ricreerà le tabelle) e esegui `npm run create-admin`.

### Opzione 2: Usa Docker per PostgreSQL
```bash
docker run --name portal-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=portal_db -p 5432:5432 -d postgres

# Aggiorna .env
DATABASE_URL=postgresql://postgres:password@localhost:5432/portal_db

# Riavvia server e crea admin
npm start
npm run create-admin
```

---

## ✅ Checklist Post-Fix

- [ ] `npm run migrate` eseguito con successo
- [ ] `npm run create-admin` eseguito con successo
- [ ] Server riavviato
- [ ] Login con `admin` / `Admin123!` funziona
- [ ] Vedi la dashboard dopo il login
