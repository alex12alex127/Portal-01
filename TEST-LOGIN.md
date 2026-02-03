# Guida Test Login

## 🔧 Setup Iniziale

### 1. Installa Dipendenze
```bash
cd Portal-01
npm install
```

### 2. Configura Database
Crea/modifica il file `.env`:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/portal_db
PORT=3000
NODE_ENV=development
SESSION_SECRET=test-secret-key-123
JWT_SECRET=test-jwt-key-456
```

### 3. Avvia PostgreSQL
Assicurati che PostgreSQL sia in esecuzione sulla porta 5432.

### 4. Crea Account Admin
```bash
npm run create-admin
```

Questo creerà:
- Username: `admin`, Password: `Admin123!`
- Username: `manager`, Password: `Manager123!`
- Username: `user`, Password: `User123!`

### 5. Avvia Server
```bash
npm start
```

### 6. Apri Browser
Vai su: http://localhost:3000

---

## 🐛 Troubleshooting

### Errore: "Cannot connect to database"
```bash
# Verifica che PostgreSQL sia in esecuzione
# Windows:
services.msc
# Cerca "PostgreSQL" e verifica sia "Running"

# Oppure usa Docker:
docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres
```

### Errore: "Token CSRF non valido"
Ho temporaneamente disabilitato CSRF per debug. Se persiste:
1. Cancella i cookie del browser
2. Riavvia il server
3. Riprova

### Errore: "Credenziali non valide"
1. Verifica di aver eseguito `npm run create-admin`
2. Controlla i log del server per vedere cosa succede
3. Prova a registrarti manualmente

### Errore: "Module not found"
```bash
npm install express pg dotenv bcryptjs express-session ejs express-rate-limit helmet validator
```

### Il server non si avvia
1. Verifica che la porta 3000 sia libera
2. Controlla il file `.env` sia configurato
3. Verifica DATABASE_URL sia corretto

---

## 📝 Test Manuale

### Test 1: Registrazione
1. Vai su http://localhost:3000
2. Clicca "Registrati"
3. Compila il form:
   - Username: `test`
   - Email: `test@test.com`
   - Nome: `Test User`
   - Password: `Test123!`
4. Clicca "Registrati"

### Test 2: Login
1. Vai su http://localhost:3000
2. Inserisci:
   - Username: `admin`
   - Password: `Admin123!`
3. Clicca "Accedi"

### Test 3: Verifica Database
```sql
-- Connettiti al database
psql -U postgres -d portal_db

-- Verifica utenti
SELECT username, role, is_active FROM users;

-- Verifica password (dovrebbe essere hashata)
SELECT username, password FROM users WHERE username = 'admin';
```

---

## 🔍 Debug Logs

Il server logga tutte le operazioni. Controlla la console per:

```
[2026-02-03T...] GET /auth/login - IP: ::1
[2026-02-03T...] POST /auth/login - IP: ::1
[2026-02-03T...] Login attempt - Username: admin, Success: true, IP: ::1
```

Se vedi errori, copia e incolla il messaggio.

---

## ✅ Checklist

- [ ] PostgreSQL in esecuzione
- [ ] File `.env` configurato
- [ ] `npm install` eseguito
- [ ] `npm run create-admin` eseguito
- [ ] Server avviato con `npm start`
- [ ] Browser aperto su http://localhost:3000
- [ ] Provato login con `admin` / `Admin123!`

---

## 🆘 Se Ancora Non Funziona

Inviami:
1. Il messaggio di errore esatto
2. I log della console del server
3. Cosa vedi nel browser (screenshot se possibile)
4. Output di `npm run create-admin`
