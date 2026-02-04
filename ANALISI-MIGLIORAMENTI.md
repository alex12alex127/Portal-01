# Analisi Portal-01 — Miglioramenti codice e interfaccia

Analisi effettuata su server, config, middleware, routes, views e CSS.

---

## 1. Codice — Sicurezza

### 1.1 CSRF non validato
- **Dove:** `middleware/security.js` — `csrfProtection` imposta solo il token in sessione, non verifica mai le richieste POST.
- **Rischio:** Richieste cross-site possono inviare form con cookie di sessione.
- **Consiglio:** Su metodi POST/PUT/DELETE confrontare `req.body._csrf` (o header `X-CSRF-Token`) con `req.session.csrfToken` e rispondere 403 se non coincidono.

### 1.2 Sanitizzazione password
- **Dove:** `middleware/validation.js` — `sanitizeInput` fa `validator.escape(req.body[k].trim())` su **tutti** i campi stringa.
- **Problema:** Trim e escape sulla password possono modificarla (es. spazi legittimi) e causare login falliti.
- **Consiglio:** Escludere `password`, `current_password`, `new_password`, `confirm_password` dalla sanitizzazione (e eventualmente solo trim, mai escape).

### 1.3 Validazione email profilo
- **Dove:** `routes/profile.js` — usa regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` invece di `validator.isEmail()` usato in registrazione.
- **Consiglio:** Usare `validator.isEmail(email)` per coerenza e massima correttezza.

### 1.4 Reset password admin
- **Dove:** `routes/admin.js` — reset password controlla solo `length >= 8`, non le stesse regole (maiuscole, minuscole, numeri) della registrazione.
- **Consiglio:** Validare la nuova password con le stesse regole (opzionale ma coerente).

---

## 2. Codice — Robustezza e stile

### 2.1 Risposte di errore incoerenti
- **Dove:** Route che fanno `res.status(500).send('Errore del server')` (testo) vs `res.status(500).json({ error: '...' })` (JSON).
- **Problema:** Le pagine renderizzate (GET) inviano HTML; le API (POST) inviano JSON. Se una richiesta GET fallisce si invia testo; per richieste fetch il client si aspetta JSON.
- **Consiglio:** Per route che renderizzano HTML, mantenere `res.status(500).send(...)` o fare render di una pagina errore. Per route chiamate via fetch, restare su `res.json({ error })`. Documentare lo standard (es. “le API JSON hanno sempre corpo `{ success, message?, error? }`”).

### 2.2 Profilo — possibile crash
- **Dove:** `routes/profile.js` — `change-password`: si usa `r.rows[0].password` senza verificare `r.rows.length`.
- **Rischio:** Se per bug l’utente non è in DB, `r.rows[0]` è `undefined` e si va in crash.
- **Consiglio:** `if (r.rows.length === 0) return res.status(404).json({ error: 'Utente non trovato' });` prima di usare `r.rows[0]`.

### 2.3 Accesso negato per utenti non admin
- **Dove:** `middleware/auth.js` — `requireRole` e `requireAdmin` rispondono con `res.status(403).json({ error: 'Accesso negato' })`.
- **Problema:** Un utente “user” che apre `/admin/users` nel browser riceve JSON invece di una pagina “Accesso negato” leggibile.
- **Consiglio:** Distinguere richieste “HTML” da “API”: se `Accept` contiene `text/html`, fare `res.redirect('/dashboard')` o render di una view `403.ejs`; per le API mantenere 403 JSON.

### 2.4 Duplicazione `csrfToken` nei render
- **Dove:** Ogni route passa esplicitamente `csrfToken: req.session.csrfToken` alle view.
- **Consiglio:** Impostare in un middleware `res.locals.csrfToken = req.session.csrfToken` (e magari `res.locals.user = req.session.user` per le pagine autenticate) così le view lo hanno sempre e non si ripete in ogni `res.render()`.

### 2.5 Log login in produzione
- **Dove:** `middleware/security.js` — `logLoginAttempt` fa sempre `console.log` con username e IP.
- **Consiglio:** In produzione evitare di loggare username (privacy) o usare solo “Login success/fail” con livello log appropriato.

---

## 3. Codice — Database e performance

### 3.1 Pool PostgreSQL
- **Dove:** `config/database.js` — `Pool` senza `max` esplicito.
- **Consiglio:** In produzione impostare `max: 10` (o simile) per evitare troppe connessioni sotto carico.

### 3.2 Paginazione
- **Dove:** `GET /admin/users` e `GET /admin/ferie` caricano tutti i record.
- **Problema:** Con molti utenti o molte richieste ferie le query e il rendering diventano pesanti.
- **Consiglio:** Introdurre paginazione (es. `?page=1&limit=20`) con `LIMIT`/`OFFSET` (o meglio `WHERE id > last_id`) e pulsanti “Precedente / Successivo” in vista.

---

## 4. Interfaccia — UX e feedback

### 4.1 Uso di `alert()` e `confirm()`/`prompt()`
- **Dove:** Admin utenti (ruolo, toggle, reset pwd, elimina), admin ferie (approva, rifiuta).
- **Problema:** Dialoghi nativi sono invasivi e poco coerenti con il design.
- **Consiglio:** Sostituire con:
  - **Messaggi di esito:** banner/toast in pagina (es. “Ruolo aggiornato”, “Richiesta approvata”) con classe tipo `.message-ok` / `.message-error`, che scompaiono dopo qualche secondo.
  - **Conferme:** modale in HTML/CSS (es. “Sei sicuro di eliminare questo utente?”) con pulsanti Annulla / Conferma, riutilizzabile per tutte le azioni critiche.

### 4.2 Stati di caricamento sui pulsanti
- **Dove:** Form e pulsanti azione (Login, Registrati, Invia ferie, Approva/Rifiuta, Cambia ruolo, ecc.).
- **Problema:** Il pulsante viene disabilitato ma non si vede chiaramente che l’azione è in corso.
- **Consiglio:** Durante la richiesta: `btn.disabled = true; btn.textContent = 'Invio in corso...'` (o icona spinner) e ripristinare testo/stato a operazione conclusa.

### 4.3 Messaggi successo/errore nelle form
- **Dove:** Ferie, Profilo, Login, Registrazione: il messaggio viene scritto in `#ferieMsg`, `#pfMsg`, `#pwMsg`, `#msg` come testo semplice.
- **Problema:** In CSS esistono `.message-ok` e `.message-error` ma non vengono applicate in JS.
- **Consiglio:** Impostare una classe in base all’esito (es. `msg.classList.add('message-ok')` o `'message-error'`) e usare un contenitore con sfondo/colore coerente (verde/rosso) per migliorare la leggibilità.

### 4.4 Stato vuoto Gestione utenti
- **Dove:** `views/admin/users.ejs` — la tabella è sempre mostrata; se `users.length === 0` la tabella è vuota.
- **Consiglio:** Come in “Richieste ferie”, mostrare un blocco `.empty` con messaggio “Nessun utente” quando `users.length === 0`.

---

## 5. Interfaccia — Accessibilità e HTML

### 5.1 Focus e tastiera
- **Dove:** Sidebar, form, bottoni.
- **Consiglio:** Verificare che tutti i controlli siano raggiungibili da tastiera e che il focus sia visibile (es. `.sidebar__link:focus-visible`, `.btn:focus-visible` con outline/box-shadow).

### 5.2 Messaggi dinamici per screen reader
- **Dove:** Messaggi di errore/successo inseriti in pagina dopo submit.
- **Consiglio:** Usare `aria-live="polite"` (e magari `role="status"`) sul contenitore dei messaggi così gli screen reader annunciano gli esiti.

### 5.3 Label e input
- **Dove:** Ferie: `<label>Data inizio <input ...></label>` — funziona ma senza `for`/`id` il click sulla label non è esplicito.
- **Consiglio:** Usare `<label for="data_inizio">Data inizio</label>` e `id="data_inizio"` sull’input per chiarezza e accessibilità.

### 5.4 Viewport e dispositivi con notch
- **Dove:** Le view hanno `viewport` ma non `viewport-fit=cover`.
- **Consiglio:** Aggiungere `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">` dove serve per gestire safe area su dispositivi con notch.

---

## 6. Interfaccia — Design e coerenza

### 6.1 Layout e head condivisi
- **Dove:** Ogni view ripete `<!DOCTYPE>`, `<head>` (meta, title, link CSS), stessa struttura body.
- **Problema:** Duplicazione e rischio di dimenticare meta o CSS in una pagina.
- **Consiglio:** Introdurre un layout EJS (es. `views/layouts/app.ejs`) con head e struttura comune; le singole view definiscono solo `title`, `activePage` e il blocco del contenuto. Stessa idea per `layouts/auth.ejs` (login/register).

### 6.2 Testo badge stato in italiano
- **Dove:** Badge con `pending`, `approved`, `rejected` e in tabella utenti “Attivo”/“Disattivo”.
- **Consiglio:** Mostrare in italiano: “In attesa”, “Approvato”, “Rifiutato” (es. con un helper in EJS o mappa `stato -> etichetta`).

### 6.3 Font esterno
- **Dove:** `style.css` — `@import url('https://fonts.googleapis.com/...')` per Inter.
- **Problema:** Richiesta esterna che può rallentare il first paint e dipendere dalla rete.
- **Consiglio:** Valutare font locale (es. `@font-face` con file in `public/fonts`) o caricare il font in modo asincrono per non bloccare il rendering.

---

## 7. Linter e qualità codice

### 7.1 ESLint / Prettier
- **Stato:** Non risultano configurati nel progetto.
- **Consiglio:** Aggiungere ESLint (e opzionalmente Prettier) con regole base (es. `eslint:recommended`), e script `npm run lint` / `npm run format` per uniformare stile e individuare bug (variabili non usate, ref mancanti, ecc.).

### 7.2 Validazione input lato client (opzionale)
- **Dove:** Form ferie (date), registrazione (email, password), profilo (email).
- **Consiglio:** Aggiungere attributi HTML5 (`required`, `type="email"`, `minlength`) e, se utile, un po’ di JS per messaggi di errore inline prima del submit. Il server deve comunque restare l’unica fonte di verità.

---

## 8. Riepilogo priorità

| Priorità | Area        | Intervento |
|----------|-------------|------------|
| Alta     | Sicurezza   | Validare CSRF su POST/PUT/DELETE; escludere password da sanitizeInput |
| Alta     | Robustezza  | Controllare `r.rows.length` in change-password; 403 HTML per utenti non admin |
| Media    | UX          | Sostituire alert/confirm con messaggi in pagina e modale di conferma |
| Media    | UX          | Loading state sui pulsanti e classi message-ok/message-error sui messaggi |
| Media    | Interfaccia | Layout EJS condiviso; stato vuoto in Gestione utenti; badge in italiano |
| Bassa    | Performance | Paginazione admin users/ferie; pool DB max; font locale |
| Bassa    | Qualità     | ESLint/Prettier; label con for/id; aria-live sui messaggi |

Se vuoi, il passo successivo può essere implementare solo le voci “Alta” (sicurezza e robustezza) oppure partire da UX (messaggi e modale).
