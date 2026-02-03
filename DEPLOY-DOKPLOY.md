# Guida Deploy su Dokploy

## 📦 Setup Completo su Dokploy

### Passo 1: Crea Database PostgreSQL

1. Vai su Dokploy dashboard
2. Clicca su **"Databases"** o **"Services"**
3. Clicca **"Create Database"**
4. Seleziona **PostgreSQL**
5. Configura:
   - **Name**: `portal-db` (o nome a tua scelta)
   - **Database Name**: `portal_db`
   - **Username**: `postgres` (default)
   - **Password**: Genera una password sicura o usa la tua
   - **Port**: `5432` (default)
6. Clicca **"Create"**
7. **IMPORTANTE**: Copia la stringa di connessione (DATABASE_URL)

Esempio stringa:
```
postgresql://postgres:tuapassword@postgres-service:5432/portal_db
```

---

### Passo 2: Crea Applicazione

1. Vai su **"Applications"**
2. Clicca **"Create Application"**
3. Seleziona **"Git Repository"** o **"Docker"**

#### Opzione A: Da Git Repository

1. Connetti il tuo repository GitHub/GitLab
2. Seleziona il branch (es. `main`)
3. Dokploy rileverà automaticamente il `Dockerfile`

#### Opzione B: Da Locale (se non hai Git)

1. Puoi fare push del codice su GitHub prima
2. Oppure usa Docker build locale

---

### Passo 3: Configura Variabili Ambiente

Nella sezione **"Environment Variables"** dell'applicazione, aggiungi:

```env
DATABASE_URL=postgresql://postgres:tuapassword@postgres-service:5432/portal_db
NODE_ENV=production
PORT=3000
SESSION_SECRET=genera-stringa-casuale-lunga-64-caratteri
JWT_SECRET=altra-stringa-casuale-lunga-64-caratteri
```

#### Come Generare Chiavi Sicure:

**Metodo 1 - Online:**
Vai su https://randomkeygen.com/ e copia una "CodeIgniter Encryption Key"

**Metodo 2 - PowerShell:**
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | % {[char]$_})
```

**Metodo 3 - Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Passo 4: Deploy Applicazione

1. Clicca **"Deploy"** o **"Build & Deploy"**
2. Dokploy farà:
   - Build dell'immagine Docker
   - Deploy del container
   - Connessione al database
3. Attendi che lo stato diventi **"Running"**

---

### Passo 5: Crea Account Admin

Dopo il primo deploy, devi creare gli account admin.

#### Opzione A: Tramite Console Dokploy

1. Vai all'applicazione
2. Clicca su **"Console"** o **"Terminal"**
3. Esegui:
```bash
npm run create-admin
```

#### Opzione B: Tramite SSH al Server

1. Connettiti al server Dokploy via SSH
2. Trova il container:
```bash
docker ps | grep portal
```
3. Entra nel container:
```bash
docker exec -it <container-id> sh
```
4. Esegui:
```bash
npm run create-admin
```
5. Esci:
```bash
exit
```

---

### Passo 6: Accedi all'App

1. Dokploy ti fornirà un URL (es. `https://portal.tuodominio.com`)
2. Apri il browser e vai all'URL
3. Fai login con:
   - Username: `admin`
   - Password: `Admin123!`
4. **IMPORTANTE**: Vai su "Profilo" e cambia subito la password!

---

## 🔧 Configurazione Avanzata

### Domini Personalizzati

1. Vai su **"Domains"** nell'applicazione
2. Aggiungi il tuo dominio
3. Dokploy configurerà automaticamente SSL con Let's Encrypt

### Backup Database

1. Vai al database PostgreSQL
2. Configura backup automatici
3. Oppure usa:
```bash
docker exec <postgres-container> pg_dump -U postgres portal_db > backup.sql
```

### Logs

Per vedere i log dell'applicazione:
1. Vai all'applicazione su Dokploy
2. Clicca su **"Logs"**
3. Vedrai tutti i log in tempo reale

---

## 🐛 Troubleshooting

### Errore: "Cannot connect to database"

**Causa**: DATABASE_URL non corretto

**Soluzione**:
1. Verifica che il database sia "Running"
2. Controlla che DATABASE_URL sia corretto
3. Il formato deve essere: `postgresql://user:password@host:5432/dbname`
4. Se database e app sono su Dokploy, usa il nome interno (es. `postgres-service`)

### Errore: "Application crashed"

**Causa**: Variabili ambiente mancanti o errore nel codice

**Soluzione**:
1. Controlla i logs
2. Verifica tutte le variabili ambiente siano configurate
3. Verifica che SESSION_SECRET e JWT_SECRET siano impostati

### Errore: "Port already in use"

**Causa**: Porta 3000 già occupata

**Soluzione**:
1. Dokploy gestisce automaticamente le porte
2. Non serve cambiare nulla, usa PORT=3000

### Non riesco a creare admin

**Soluzione 1**: Usa la console Dokploy
**Soluzione 2**: Crea manualmente nel database:

```sql
-- Connettiti al database da Dokploy console
psql $DATABASE_URL

-- Crea admin manualmente
INSERT INTO users (username, email, password, full_name, role, is_active)
VALUES (
  'admin',
  'admin@portal01.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWEgEjqK', -- Password: Admin123!
  'Amministratore',
  'admin',
  true
);
```

---

## ✅ Checklist Deploy

- [ ] Database PostgreSQL creato su Dokploy
- [ ] DATABASE_URL copiato
- [ ] Applicazione creata
- [ ] Variabili ambiente configurate (DATABASE_URL, SESSION_SECRET, JWT_SECRET, NODE_ENV)
- [ ] Deploy completato con successo
- [ ] Applicazione in stato "Running"
- [ ] `npm run create-admin` eseguito
- [ ] Login funzionante
- [ ] Password admin cambiata

---

## 📝 Note Importanti

1. **Sicurezza**: Cambia sempre le password di default in produzione
2. **Backup**: Configura backup automatici del database
3. **Monitoring**: Controlla regolarmente i logs
4. **Updates**: Fai push su Git per aggiornare l'app (Dokploy farà auto-deploy)
5. **SSL**: Dokploy configura automaticamente HTTPS

---

## 🆘 Supporto

Se hai problemi:
1. Controlla i logs su Dokploy
2. Verifica che database sia "Running"
3. Testa la connessione al database
4. Controlla che tutte le variabili ambiente siano configurate

Inviami:
- Screenshot dell'errore
- Logs dell'applicazione
- Configurazione variabili ambiente (senza password!)
