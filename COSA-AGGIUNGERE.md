# Portal-01 — Cosa potresti aggiungere

Sintesi di possibili estensioni e miglioramenti, basata sull’analisi dell’app e sui documenti esistenti (ANALISI-APP-LACUNE.md, ANALISI-MIGLIORAMENTI.md, CONSIGLI-GESTIONE-FERIE.md).

---

## Priorità alta (impatto diretto su utenti e processo)

### 1. Recupero password (“Password dimenticata?”)
- **Ora:** Nessun flusso di reset via email.
- **Aggiunta:** Link “Password dimenticata?” in login → inserimento email → invio email con link con token (scadenza es. 1h) → pagina “Nuova password” → salvataggio e invalidazione token. Richiede configurazione SMTP (es. Nodemailer) e tabella `password_reset_tokens`.

### 2. Notifiche quando la richiesta viene approvata/rifiutata
- **Ora:** L’utente deve andare in “Le mie richieste” per vedere l’esito.
- **Aggiunta:** All’approvazione/rifiuto da admin: invio email all’utente (o notifica in-app in dashboard). Opzionale: piccolo pannello “Ultime notifiche” in dashboard con link alla pagina ferie.

### 3. Modifica e ritiro richiesta da parte dell’utente (se in attesa)
- **Ora:** L’admin può già modificare/cancellare; l’utente no.
- **Aggiunta:** Nella sezione “Le mie richieste”, per le richieste **In attesa**: pulsanti **Modifica** (stesso form precompilato, salvataggio con PUT) e **Ritira** (stato `withdrawn` o `rejected`). Route es. `PUT /ferie/:id` (solo proprie, solo pending), `POST /ferie/:id/withdraw`.

### 4. Health check e session store persistente
- **Health check:** Route `GET /health` (e opzionale `GET /health/db` con `SELECT 1`) per load balancer, Docker e monitoraggio.
- **Sessioni:** Oggi in memoria → restart cancella tutto. Aggiungere **connect-pg-simple** (o simile) per salvare le sessioni su PostgreSQL: utili per multi-istanza e resilienza.

### 5. Validazione CSRF e password non sanitizzate
- **CSRF:** Verificare il token su POST/PUT/DELETE (confronto `req.body._csrf` o header con `req.session.csrfToken`) e rispondere 403 se non valido.
- **Password:** Escludere i campi password da `sanitizeInput` (già indicato in ANALISI-MIGLIORAMENTI: no escape/trim che alterano la password).

---

## Priorità media (UX, controllo, operatività)

### 6. Dashboard più utile
- **Statistiche ferie:** Riepilogo “Giorni richiesti quest’anno”, “In attesa”, “Approvati”, “Rifiutati” (dati da `/ferie` o endpoint `/ferie/summary`).
- **Widget “Ultime richieste”:** Le ultime 3–5 richieste ferie con link a “Gestione Ferie”.
- **Annunci:** Sezione “Avvisi” (solo testo o lista) gestita da admin (richiede tabella `annunci` e pagina admin).

### 7. Filtri nelle liste
- **Le mie richieste:** Filtri rapidi per **Stato** (Tutte / In attesa / Approvate / Rifiutate), **Anno**, **Tipo** (ferie/permesso/malattia).
- **Admin ferie:** Filtro per dipendente (select utente), stato, intervallo date.
- **Admin utenti:** Ricerca per nome/username e filtro per ruolo / attivo-disattivo.

### 8. Giorni lavorativi e policy ferie
- **Giorni lavorativi:** Calcolo che esclude sabato/domenica (e opzionale tabella festivi). Mostrare “X giorni (lavorativi)” in creazione e in lista.
- **Limiti:** Configurare massimo giorni per richiesta e massimo annuo per utente; validazione in backend e messaggio in frontend (“Hai usato X di Y giorni”).

### 9. Conferma email in registrazione
- **Flusso:** Dopo la registrazione invio email “Conferma il tuo account” con link; account attivo solo dopo click (campo `email_verified` o simile). Riduce account finti e migliora sicurezza.

### 10. Migrazioni DB e test
- **Migrazioni:** Sistema versionato (es. **node-pg-migrate**, Knex migrations) invece di solo “CREATE IF NOT EXISTS” a avvio: cambi schema controllati e ripetibili.
- **Test:** Suite minima (Jest o Mocha): test su login, creazione ferie, approvazione, cambio ruolo; almeno alcuni test di integrazione su route critiche.

### 11. Logging e audit essenziale
- **Logging:** Logger strutturato (es. JSON con livello, timestamp, requestId) invece di solo `console.log`/`console.error`.
- **Audit:** Registrare chi fa cosa (es. “admin X ha approvato richiesta Y”, “utente Z ha cambiato email”). Tabella `audit_log` o simile e scrittura su azioni sensibili.

---

## Priorità bassa (nice-to-have)

### 12. Recupero account e privacy
- **Cancellazione account da utente:** “Elimina il mio account” in Profilo (con conferma e eventuale periodo di “sospensione” prima della cancellazione effettiva).
- **Esportazione dati:** “Scarica i miei dati” (JSON o CSV: profilo, richieste ferie) per diritto di portabilità.
- **Privacy/Cookie:** Pagina “Privacy policy” e “Cookie policy”, eventuale banner cookie se usi analytics.

### 13. Invito utenti (invece di sola registrazione aperta)
- **Admin** crea “Invito” (email) → link con token → la prima visita completa la registrazione (password, nome). Utile in contesto aziendale.

### 14. UX e interfaccia
- **Tema scuro:** Toggle in Profilo o in header; variabili CSS per tema chiaro/scuro.
- **Breadcrumb:** Es. “Dashboard > Ferie” per orientamento.
- **Pagina 500:** In caso di errore server su richiesta HTML, mostrare una pagina “Errore” invece di JSON o testo grezzo.
- **Export / stampa:** Export CSV o stampa “Le mie richieste” o riepilogo ferie anno; per admin export lista richieste o report.

### 15. Calendario e report
- **Calendario utente:** Evidenziare in modo diverso i giorni in cui **tu** sei in ferie (approvate) rispetto agli altri.
- **Report admin:** Statistiche ferie per dipendente, per periodo, per tipo; vista tabellare o grafico semplice (es. giorni per mese).

### 16. Secondo modulo (es. Magazzino)
- **Dashboard** ha già la card “Magazzino” disabilitata. Si può abilitare un modulo minimo: lista articoli, quantità, movimenti (carico/scarico), con permessi solo per certi ruoli.

---

## Riepilogo per “da dove partire”

| Se vuoi… | Parti da |
|----------|----------|
| Sicurezza e robustezza | Health check, CSRF, session store, escludere password da sanitize |
| Esperienza utente ferie | Notifiche approvazione/rifiuto, modifica/ritiro richiesta utente, filtri, giorni lavorativi |
| Autonomia utente | Recupero password, conferma email, cancellazione/export dati |
| Operatività e manutenzione | Migrazioni DB, test, logging, audit log |
| Valorizzare la dashboard | Statistiche ferie, ultime richieste, annunci |
| Estendere il prodotto | Invito utenti, tema scuro, report admin, modulo Magazzino |

Se mi dici su quale area vuoi concentrarti per prima (es. “notifiche”, “recupero password”, “dashboard”), posso proporti i passi concreti (route, tabelle, modifiche alle view) da implementare.
