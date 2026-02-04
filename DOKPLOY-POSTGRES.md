# Istruzioni precise: collegare PostgreSQL su Dokploy

Segui questi passi **nell’ordine** per avere l’app Portal-01 con database PostgreSQL su Dokploy.

---

## Parte 1: Creare il database PostgreSQL su Dokploy

1. Accedi alla **dashboard di Dokploy** (il pannello web).

2. Nel menu laterale cerca **"Database"** o **"Databases"** o **"Services"** e clicca.

3. Clicca **"Create"** / **"Add Database"** / **"New"** e scegli **PostgreSQL**.

4. Compila il form (esempi sotto; i nomi possono cambiare in base alla versione di Dokploy):

   | Campo | Valore da mettere |
   |-------|--------------------|
   | **Name** (nome servizio) | `portal-db` |
   | **Database Name** | `portal_db` |
   | **Username** | `postgres` |
   | **Password** | Scegli una password sicura e **annotala** (es. `LaMiaPassword123!`) |
   | **Port** (se richiesto) | `5432` |

5. Clicca **"Create"** / **"Deploy"** e attendi che il database sia **Running** (verde).

6. **Trovare la stringa di connessione (DATABASE_URL)**  
   - Clicca sul database appena creato.  
   - Cerca una sezione tipo **"Connection"**, **"Connection String"**, **"Environment"** o **"Connect"**.  
   - Dokploy spesso mostra qualcosa tipo:
     - **Host**: `portal-db` oppure `postgres.xxx.svc` (nome interno del servizio)
     - **Port**: `5432`
     - **Database**: `portal_db`
     - **User**: `postgres`
     - **Password**: quella che hai messo al punto 4  

   La **DATABASE_URL** va costruita così (sostituisci con i valori veri):

   ```
   postgresql://postgres:LA_TUA_PASSWORD@portal-db:5432/portal_db
   ```

   - Se l’host è diverso (es. `postgres.default.svc.cluster.local`), usa quello al posto di `portal-db`:
     ```
     postgresql://postgres:LA_TUA_PASSWORD@NOME_HOST:5432/portal_db
     ```
   - **Copia e salva** questa stringa (senza spazi davanti/dietro): ti serve per l’app.

---

## Parte 2: Creare l’applicazione Portal-01 su Dokploy

1. Nel menu Dokploy vai su **"Applications"** / **"Apps"** e clicca **"Create"** / **"New Application"**.

2. Scegli **"Git"** / **"Git Repository"** e collega il repository che contiene Portal-01 (GitHub/GitLab ecc.).  
   - Inserisci URL del repo e, se serve, token/branch (es. `main`).

3. **Build**  
   - Dokploy di solito rileva il **Dockerfile** nella root del progetto.  
   - Se chiede "Build Pack" o "Dockerfile", seleziona **Dockerfile** e conferma.

4. **Variabili d’ambiente (Environment Variables)**  
   Nella sezione **Environment** / **Env** dell’applicazione aggiungi **tutte** queste variabili (una per riga, Nome = Valore):

   | Nome | Valore |
   |------|--------|
   | `DATABASE_URL` | La stringa copiata al passo 6 della Parte 1 (es. `postgresql://postgres:LaMiaPassword123!@portal-db:5432/portal_db`) |
   | `NODE_ENV` | `production` |
   | `PORT` | `3000` |
   | `SESSION_SECRET` | Una stringa lunga e casuale (es. genera da https://randomkeygen.com/ – "CodeIgniter Encryption Key") |
   | `JWT_SECRET` | Un’altra stringa lunga e casuale (diversa da SESSION_SECRET) |

   **Importante:**
   - **DATABASE_URL**: nessuno spazio, una sola riga; l’host deve essere il **nome del servizio PostgreSQL** su Dokploy (es. `portal-db`), così l’app e il DB sono sulla stessa rete.
   - Se l’app e il database sono nello **stesso progetto/namespace**, l’host è di solito il **nome del servizio** (es. `portal-db`). Se non funziona, in Dokploy controlla la pagina del database per l’host corretto da usare nella URL.

5. **Collegare l’app al database (stesso progetto)**  
   - Se in Dokploy c’è la possibilità di **"Link"** o **"Connect to"** un database, seleziona il PostgreSQL creato prima.  
   - In alcuni setup questo espone automaticamente variabili tipo `DATABASE_URL`; in quel caso puoi usare quella e non duplicare a mano.

6. **Deploy**  
   - Clicca **"Deploy"** / **"Build and Deploy"** e attendi che il build finisca e l’applicazione sia **Running**.

7. **Dominio (opzionale)**  
   - Nella sezione **Domain** / **Domains** puoi aggiungere il tuo dominio; Dokploy può gestire HTTPS (es. Let’s Encrypt).

---

## Parte 3: Creare le tabelle e l’utente admin

L’app alla prima richiesta crea da sola le tabelle (`users`, `ferie`) se il database è raggiungibile. Poi **devi** creare gli utenti di default (admin, manager, user) con lo script.

1. Su Dokploy apri la tua **applicazione** (Portal-01).

2. Cerca **"Console"**, **"Terminal"**, **"Shell"** o **"Execute Command"** e aprilo (così entri nel container dell’app).

3. Nel terminale esegui **in ordine**:

   ```bash
   cd /app
   ```

   Poi:

   ```bash
   npm run create-admin
   ```

4. Dovresti vedere messaggi tipo:
   - `✓ Admin created`
   - `✓ Manager created`
   - `✓ User created`
   - `✅ All users created successfully!`

5. Esci dal terminale (es. `exit` o chiudi la finestra).

---

## Parte 4: Verificare che tutto funzioni

1. Apri l’**URL** dell’app (quello che Dokploy ti assegna o il tuo dominio).

2. Dovresti vedere la pagina di **Login**.

3. Accedi con:
   - **Username:** `admin`  
   - **Password:** `Admin123!`

4. Dopo il login cambia subito la password da **Profilo** (in produzione non lasciare password di default).

---

## Risoluzione problemi

### Errore "Cannot connect to database" / 502 dopo il deploy

- Controlla che **DATABASE_URL** sia esattamente come nella Parte 1 (stesso host, porta, database, user, password).
- **Host**: deve essere il nome del **servizio** PostgreSQL su Dokploy (es. `portal-db`), non `localhost` né l’IP del server.
- Verifica che il **database PostgreSQL** sia in stato **Running**.
- Verifica che l’app e il database siano nello **stesso progetto/namespace** su Dokploy (così la rete interna risolve il nome `portal-db`).

### "DATABASE_URL non configurata"

- Nella sezione **Environment** dell’**applicazione** (non del database) deve esserci la variabile **DATABASE_URL**.
- Dopo averla aggiunta o modificata, fai un **nuovo deploy** (Redeploy) dell’app.

### Console: "Cannot find module" o "npm: command not found"

- Assicurati di essere nella directory dell’app: `cd /app` e poi `npm run create-admin`.
- Se il path è diverso (es. `/src`), adatta il `cd` a quello che vedi nella documentazione del tuo tipo di deploy Dokploy.

### Login non funziona / "Credenziali non valide"

- Controlla di aver eseguito **npm run create-admin** dalla console (Parte 3).
- Usa esattamente **admin** / **Admin123!** (rispettando maiuscole/minuscole).

---

## Riepilogo variabili per l’app

| Variabile | Obbligatoria | Esempio |
|-----------|--------------|--------|
| `DATABASE_URL` | Sì | `postgresql://postgres:PASSWORD@portal-db:5432/portal_db` |
| `NODE_ENV` | Sì (in prod) | `production` |
| `PORT` | Sì | `3000` |
| `SESSION_SECRET` | Sì | stringa casuale lunga |
| `JWT_SECRET` | Sì | stringa casuale lunga (diversa) |

L’host nella **DATABASE_URL** deve essere il **nome del servizio PostgreSQL** visibile nella dashboard Dokploy (es. `portal-db`).
