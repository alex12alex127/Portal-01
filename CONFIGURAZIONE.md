# Guida Configurazione Variabili Ambiente

## 1. Configurazione Locale (Sviluppo)

Crea il file `.env` nella root del progetto:

```bash
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/portal_db

# Server Configuration
PORT=3000
NODE_ENV=development

# Session Secret
SESSION_SECRET=mia-chiave-segreta-super-sicura-123

# JWT Secret
JWT_SECRET=altro-segreto-jwt-456
```

### Spiegazione variabili:

- **DATABASE_URL**: Stringa di connessione PostgreSQL
  - Formato: `postgresql://username:password@host:port/database_name`
  - Esempio locale: `postgresql://postgres:postgres@localhost:5432/portal_db`
  
- **PORT**: Porta su cui gira l'app (default 3000)

- **NODE_ENV**: 
  - `development` per sviluppo locale
  - `production` per produzione

- **SESSION_SECRET**: Chiave per criptare le sessioni (usa stringa casuale lunga)

- **JWT_SECRET**: Chiave per token JWT (usa stringa casuale lunga)

---

## 2. Configurazione su Dokploy

### Metodo 1: Interfaccia Web Dokploy

1. Vai al tuo progetto su Dokploy
2. Clicca su **"Environment Variables"** o **"Settings"**
3. Aggiungi le variabili una per una:

```
Nome: DATABASE_URL
Valore: postgresql://postgres:tuapassword@postgres:5432/portal_db

Nome: NODE_ENV
Valore: production

Nome: SESSION_SECRET
Valore: genera-stringa-casuale-lunga-e-sicura

Nome: JWT_SECRET
Valore: altra-stringa-casuale-diversa

Nome: PORT
Valore: 3000
```

### Metodo 2: File dokploy.json (se supportato)

Crea `dokploy.json` nella root:

```json
{
  "env": {
    "DATABASE_URL": "postgresql://postgres:password@postgres:5432/portal_db",
    "NODE_ENV": "production",
    "SESSION_SECRET": "tua-chiave-segreta",
    "JWT_SECRET": "tua-chiave-jwt",
    "PORT": "3000"
  }
}
```

---

## 3. Database PostgreSQL su Dokploy

### Opzione A: Database Interno Dokploy

Se Dokploy fornisce PostgreSQL:
1. Crea database PostgreSQL dal pannello
2. Copia la stringa di connessione fornita
3. Usala come DATABASE_URL

### Opzione B: Database Esterno

Se usi database esterno (es. Supabase, Railway):
```
DATABASE_URL=postgresql://user:pass@external-host.com:5432/dbname
```

---

## 4. Generare Chiavi Segrete Sicure

### Su Windows (PowerShell):
```powershell
# Genera stringa casuale
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

### Online:
Usa: https://randomkeygen.com/

### Node.js:
```javascript
require('crypto').randomBytes(32).toString('hex')
```

---

## 5. Verifica Configurazione

Dopo aver configurato, verifica che l'app legga le variabili:

```javascript
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Configurato' : 'Mancante');
console.log('PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
```

---

## 6. Esempio Completo per Dokploy

```
DATABASE_URL=postgresql://postgres:mypassword123@postgres-service:5432/portal_db
NODE_ENV=production
PORT=3000
SESSION_SECRET=8f3d9a2b7c1e5f4a6d8b9c2e1f3a5b7c9d2e4f6a8b1c3d5e7f9a2b4c6d8e1f3
JWT_SECRET=2a4b6c8d1e3f5a7b9c2d4e6f8a1b3c5d7e9f2a4b6c8d1e3f5a7b9c2d4e6f8a1
```

---

## Troubleshooting

### Errore: "Cannot connect to database"
- Verifica DATABASE_URL sia corretto
- Controlla che PostgreSQL sia avviato
- Verifica host/porta/credenziali

### Errore: "Session secret not set"
- Aggiungi SESSION_SECRET nelle variabili ambiente

### App non si avvia
- Controlla i log di Dokploy
- Verifica tutte le variabili siano configurate
