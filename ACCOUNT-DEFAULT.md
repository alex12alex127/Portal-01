# Account di Default

## 🔐 Credenziali Account Predefiniti

### Admin (Amministratore)
```
Username: admin
Password: Admin123!
Ruolo: admin
Email: admin@portal01.com
```

### Manager
```
Username: manager
Password: Manager123!
Ruolo: manager
Email: manager@portal01.com
```

### User (Utente Test)
```
Username: user
Password: User123!
Ruolo: user
Email: user@portal01.com
```

---

## 📋 Come Creare gli Account

### Metodo 1: Script Automatico (Consigliato)

1. Assicurati che il database sia configurato nel file `.env`
2. Esegui il comando:
```bash
npm run create-admin
```

Lo script creerà automaticamente tutti e tre gli account.

### Metodo 2: Manuale via Registrazione

Puoi registrarti normalmente e poi cambiare il ruolo nel database:

```sql
UPDATE users SET role = 'admin' WHERE username = 'tuo_username';
```

---

## 🔑 Ruoli e Permessi

### Admin
- Accesso completo a tutte le funzionalità
- Gestione utenti
- Approvazione/rifiuto ferie
- Accesso a tutti i moduli

### Manager
- Approvazione/rifiuto ferie del team
- Visualizzazione richieste team
- Accesso moduli assegnati

### User
- Richiesta ferie personali
- Visualizzazione proprie richieste
- Accesso moduli base

---

## ⚠️ IMPORTANTE - Sicurezza

### In Produzione:

1. **Cambia SUBITO le password di default**
2. **Disabilita o elimina gli account non necessari**
3. **Usa password complesse e uniche**
4. **Abilita 2FA quando disponibile**

### Cambiare Password:

```sql
-- Esempio per cambiare password admin
UPDATE users 
SET password = '$2a$12$...' -- usa bcrypt per hashare
WHERE username = 'admin';
```

Oppure implementa la funzione "Cambia Password" nell'app.

---

## 🛠️ Gestione Account

### Disabilitare un Account
```sql
UPDATE users SET is_active = false WHERE username = 'user';
```

### Riabilitare un Account
```sql
UPDATE users SET is_active = true WHERE username = 'user';
```

### Eliminare un Account
```sql
DELETE FROM users WHERE username = 'user';
```

### Cambiare Ruolo
```sql
UPDATE users SET role = 'manager' WHERE username = 'user';
```

---

## 📝 Note

- Gli account vengono creati con `is_active = true`
- Le password sono hashate con bcrypt (12 rounds)
- Se esegui lo script più volte, aggiorna le password esistenti
- I ruoli validi sono: `admin`, `manager`, `user`
