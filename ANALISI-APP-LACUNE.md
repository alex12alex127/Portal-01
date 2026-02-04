# Analisi approfondita Portal-01 — Cosa ha l’app e cosa manca

Documento che elenca tutto ciò che l’applicazione **ha già** e tutto ciò che **manca** (funzionalità, sicurezza, infrastruttura, UX, codice).

---

## 1. Cosa ha l’app (inventario)

### 1.1 Stack tecnico
- **Runtime:** Node.js (engine >=18)
- **Framework:** Express 4.x
- **Template:** EJS con `express-ejs-layouts` (layout `app` e `auth`)
- **DB:** PostgreSQL tramite `pg` (Pool, init a avvio, indici su `ferie`)
- **Sessioni:** `express-session` in memoria (cookie httpOnly, secure in prod, sameSite lax, 24h)
- **Sicurezza:** Helmet (CSP), compressione gzip, rate limit (login 5/15min, register 3/h, api 100/15min), CSRF su POST/PUT/DELETE, sanitizzazione input (escape, password escluse)
- **Validazione:** `validator` (email, escape), regex per username/password, validazione ferie (date, tipo)
- **Deploy:** Dockerfile (Node 18 Alpine), .dockerignore, docker-compose, documentazione Dokploy/PostgreSQL

### 1.2 Autenticazione e autorizzazione
- **Login:** username + password, bcrypt, blocco 30 min dopo 5 tentativi falliti (per username+IP), last_login aggiornato, utente disattivo → 403
- **Registrazione:** username, email, full_name, password (8+ caratteri, maiuscole/minuscole/numeri), ruolo default `user`
- **Logout:** destroy session, redirect a login
- **Ruoli:** `user`, `manager`, `admin`
- **Middleware:** `requireAuth` (redirect a login se non loggato, 401 JSON per API), `requireRole(...roles)` (403 JSON o redirect a dashboard per HTML), `requireAdmin`, `requireManager` (admin + manager)
- **Res.locals:** `user` e `csrfToken` iniettati per le view

### 1.3 Moduli funzionali

| Modulo | Route | Chi | Cosa fa |
|--------|--------|-----|---------|
| **Home** | GET / | Tutti | Redirect a dashboard se loggato, altrimenti a login |
| **Dashboard** | GET /dashboard | Auth | Pagina con card “Ferie” (link) e “Magazzino” (disabilitato) |
| **Login** | GET/POST /auth/login | Pubblico | Form login, rate limit, lock tentativi |
| **Registrazione** | GET/POST /auth/register | Pubblico | Form registrazione, rate limit |
| **Logout** | GET /auth/logout | Auth | Distrugge sessione |
| **Ferie** | GET /ferie | Auth | Lista “le mie richieste” + form “nuova richiesta” (data inizio/fine, tipo, note) |
| **Ferie create** | POST /ferie/create | Auth | Crea richiesta, controlla sovrapposizioni (escluso rejected), calcola giorni |
| **Profilo** | GET /profile | Auth | Dati account (username read-only, nome, email) + form cambia password |
| **Profilo update** | POST /profile/update | Auth | Aggiorna nome ed email, controllo email duplicata |
| **Profilo password** | POST /profile/change-password | Auth | Cambio password con verifica corrente |
| **Admin utenti** | GET /admin/users | Admin | Lista utenti paginata (page, limit), select ruolo, Attiva/Disattiva, Reset pwd, Elimina |
| **Admin ruolo** | POST /admin/users/:id/role | Admin | Cambio ruolo |
| **Admin toggle** | POST /admin/users/:id/toggle | Admin | Attiva/disattiva utente |
| **Admin delete** | DELETE /admin/users/:id | Admin | Elimina utente |
| **Admin reset pwd** | POST /admin/users/:id/reset-password | Admin | Reset password (stesse regole complessità) |
| **Admin ferie** | GET /admin/ferie | Manager+Admin | Lista tutte le richieste ferie (paginata), Approva/Rifiuta solo per pending |

### 1.4 Database
- **Tabelle:** `users` (id, username, email, password, full_name, role, is_active, last_login, created_at, updated_at), `ferie` (id, user_id, data_inizio, data_fine, giorni_totali, tipo, stato, note, created_at, updated_at)
- **Indici:** `idx_ferie_user_id`, `idx_ferie_created_at`, `idx_ferie_stato`
- **Init:** creazione tabelle e indici a avvio (CREATE IF NOT EXISTS)
- **Script:** `create-admin.js` (inserisce admin/manager/user di default), `migrate-db.js` (colonne is_active, last_login, updated_at)

### 1.5 Interfaccia e UX
- **Layout:** sidebar fissa (brand, nav, utente, logout), responsive con toggle e backdrop su mobile, prefetch link nav
- **Pagine:** Dashboard, Ferie, Profilo, Gestione utenti (solo admin), Approva ferie (admin/manager)
- **Design:** CSS con variabili, Inter (Google Fonts), card, badge (pending/approved/rejected in italiano), bottoni primari/secondari
- **Feedback:** toast (showToast), modale conferma (showModal), promptModal per reset pwd admin, messaggi form (message-ok / message-error), stati “Invio in corso…” sui pulsanti
- **Accessibilità:** label for/id, aria-live sui messaggi, focus-visible su link e bottoni, viewport-fit=cover
- **Empty state:** nessuna richiesta ferie, nessun utente, nessuna richiesta in admin ferie
- **Paginazione:** admin users e admin ferie con Precedente/Successivo e “Pagina X di Y (N totali)”

### 1.6 Codice e tooling
- **ESLint:** config con eslint:recommended, script `npm run lint`, ignore node_modules e public
- **Script npm:** start, dev (nodemon), create-admin, migrate, lint
- **File:** .env.example (DATABASE_URL, PORT, NODE_ENV, SESSION_SECRET, JWT_SECRET), .gitignore, .gitattributes

---

## 2. Cosa manca (lacune)

### 2.1 Funzionalità prodotto

| Area | Manca |
|------|--------|
| **Ferie** | Modifica di una richiesta già inviata (solo se ancora pending); cancellazione/ritiro da parte dell’utente; filtri (per stato, tipo, anno) nella lista “le mie richieste”; export (CSV/Excel) per utente o admin; limite massimo giorni per richiesta o per anno; policy aziendali (es. giorni massimi annui, date bloccate); conteggio giorni escludendo festivi/weekend (ora è solo differenza date + 1). |
| **Utenti** | Invito utenti (link o email) invece di sola registrazione aperta; attivazione account via link; lista utenti con ricerca/filtro (per ruolo, stato); export lista utenti; bulk (es. disattiva più utenti). |
| **Dashboard** | Statistiche (ferie approvate/rifiutate in attesa, giorni usati/rimanenti); widget “ultime richieste”; messaggi/annunci; il modulo “Magazzino” è solo placeholder. |
| **Notifiche** | Nessuna notifica (email o in-app) quando una richiesta viene approvata/rifiutata; nessun promemoria scadenza o avvisi. |
| **Recupero password** | Nessun “Password dimenticata?”: nessun flusso reset via email (token e link). |
| **Profilo** | Nessuna foto/avatar; nessuna preferenza (lingua, notifiche); storico modifiche profilo o log accessi. |
| **Admin** | Nessun log azioni (chi ha approvato/rifiutato, chi ha cambiato ruolo); nessun report o statistiche ferie (per dipendente, per periodo); filtro richieste ferie per stato/dipendente/periodo. |

### 2.2 Sicurezza e resilienza

| Aspetto | Manca |
|---------|--------|
| **Sessioni** | Store in memoria: restart del processo cancella tutte le sessioni; nessun session store persistente (es. connect-pg-simple con PostgreSQL) per multi-istanza e resilienza. |
| **Rate limit** | Login e register limitati; le API (ferie, profile, admin) usano un unico apiLimiter (100/15min) senza limiti per endpoint sensibili (es. change-password, delete user). |
| **JWT** | `.env.example` contiene `JWT_SECRET` ma l’app non usa JWT (solo session); va rimosso o documentato se previsto per API future. |
| **Audit** | Nessun log strutturato di chi fa cosa (es. “admin X ha approvato richiesta Y”, “utente Z ha cambiato email”). |
| **2FA** | Nessuna autenticazione a due fattori (TOTP o email). |
| **Password** | Nessuna politica di scadenza password; nessun blocco dopo N password errate a livello utente (solo per username+IP). |
| **CSP** | `'unsafe-inline'` per style e script: necessario per gli inline script nelle view, ma riduce la protezione CSP. |

### 2.3 Infrastruttura e operatività

| Aspetto | Manca |
|---------|--------|
| **Health check** | Nessuna route GET (es. `/health` o `/ping`) per verificare che l’app sia viva; utile per load balancer, Docker/Kubernetes e monitoraggio. |
| **DB health** | Nessun controllo che il DB risponda (es. SELECT 1 in `/health`). |
| **Test** | Nessun test (unitari, integrazione, e2e); nessuna dipendenza jest/mocha; nessuno script `npm test`. |
| **CI/CD** | Nessun workflow GitHub Actions / GitLab CI (lint, test, build). |
| **Migrazioni DB** | Schema creato a avvio con IF NOT EXISTS; nessun sistema di migrazioni versionate (es. node-pg-migrate, knex migrate) per cambi schema in modo controllato. |
| **Backup** | Nessuna documentazione o script per backup del database. |
| **Logging** | Solo console.log/console.error; nessun logger strutturato (es. JSON con livello, requestId) né rotazione file. |
| **Monitoring** | Nessuna integrazione con APM, metriche (es. Prometheus) o allarmi. |

### 2.4 UX e interfaccia

| Aspetto | Manca |
|---------|--------|
| **Internazionalizzazione** | Testi solo in italiano; nessun i18n (lingua multipla). |
| **Tema** | Solo tema chiaro; nessun tema scuro o preferenza utente. |
| **Stampa / PDF** | Nessuna vista “stampa” o export PDF per richieste ferie o riepiloghi. |
| **Shortcut** | Nessuna shortcut da tastiera documentata o esposta (es. per navigazione). |
| **Offline** | Nessun service worker o supporto offline. |
| **Conferme email** | Registrazione senza verifica email; nessun “conferma la tua email”. |
| **Breadcrumb** | Nessun breadcrumb per orientamento (es. Dashboard > Ferie). |
| **Gestione errori 500** | In caso di errore server, risposta JSON; per richieste HTML sarebbe meglio una pagina 500 dedicata. |

### 2.5 Codice e manutenzione

| Aspetto | Manca |
|---------|--------|
| **Test** | Come sopra: zero test automatici. |
| **Documentazione API** | Le route sono solo per uso interno (HTML + fetch); nessuna API REST documentata (OpenAPI/Swagger) per eventuali client esterni. |
| **Tipi** | JavaScript puro; nessun TypeScript né JSDoc per tipi. |
| **Variabili d’ambiente** | `.env.example` non documenta tutte le variabili usate (es. PORT, NODE_ENV); JWT_SECRET non usato. |
| **Controllo avvio** | Se DATABASE_URL manca, initDatabase fallisce ma il server è già in ascolto; nessun “ready” condizionato al DB (opzionale, come da scelta attuale). |
| **main.js** | `public/js/main.js` è quasi vuoto (“// Portal-01”); o si usa o si rimuove. |

### 2.6 Privacy e compliance

| Aspetto | Manca |
|---------|--------|
| **GDPR / Privacy** | Nessuna pagina privacy policy o cookie policy; nessun banner cookie; nessuna gestione consensi; nessuna documentazione su retention dati (sessioni, log, ferie). |
| **Dati sensibili** | Nessuna menzione di crittografia a riposo per dati sensibili (password già hasherate; altri dati in chiaro in DB). |
| **Esportazione dati** | L’utente non può “esportare i propri dati” (diritto di accesso/portabilità). |
| **Cancellazione account** | L’utente non può richiedere la cancellazione del proprio account (solo l’admin può eliminare utenti). |

---

## 3. Riepilogo prioritizzato

| Priorità | Categoria | Esempi di cosa manca |
|----------|-----------|----------------------|
| **Alta** | Prodotto | Recupero password, notifiche approvazione/rifiuto ferie, modifica/ritiro richiesta ferie (se pending) |
| **Alta** | Sicurezza/Scale | Session store persistente (PostgreSQL), health check (e opz. DB), audit log essenziale |
| **Media** | Prodotto | Filtri e statistiche ferie, conferma email, policy ferie (limiti, festivi) |
| **Media** | Operatività | Migrazioni DB versionate, test automatici, logging strutturato |
| **Bassa** | UX | i18n, tema scuro, PDF, breadcrumb |
| **Bassa** | Compliance | Privacy/cookie policy, esportazione dati utente, cancellazione account da utente |

---

## 4. Conclusione

L’app **ha** un nucleo solido: autenticazione, ruoli, ferie (creazione + approvazione), profilo, gestione utenti, sicurezza di base (CSRF, rate limit, validazione), UI curata e accessibile, paginazione e deploy Docker/Dokploy.

**Manca** soprattutto: recupero password, notifiche, session store persistente, health check, test, migrazioni DB, audit log, migliorie ferie (modifica/ritiro, filtri, policy), e aspetti privacy/compliance (policy, export dati, cancellazione account). Prioritizzando le voci “Alta” e “Media” si porta l’applicazione a un livello adatto a un uso aziendale reale e a un’evoluzione sicura.
