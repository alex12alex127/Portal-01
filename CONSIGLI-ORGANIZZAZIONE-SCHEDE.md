# Consigli per organizzare le schede dell’app

Analisi della struttura attuale e proposte per una navigazione più semplice e comoda.

---

## 1. Situazione attuale

### Schede / pagine

| Pagina | Chi la vede | Contenuto |
|--------|-------------|-----------|
| **Dashboard** | Tutti | Statistiche ferie, ultimi avvisi, notifiche, ultime richieste, card “Gestione Ferie” e “Magazzino” |
| **Ferie** | Tutti | Nuova richiesta, lista “Le mie richieste” (filtri), calendario |
| **Avvisi** | Tutti | Lista avvisi, segna come letto |
| **Gestione Utenti** | Link visibile a tutti, contenuto solo admin | Lista utenti, ruoli, attiva/disattiva, reset pwd, elimina |
| **Approva Ferie** | Admin/Manager | Tabella richieste, filtri, calendario, approva/rifiuta/modifica/cancella |
| **Gestione Avvisi** | Admin/Manager | Lista avvisi, nuovo/modifica/elimina, filtri |
| **Profilo** | Tutti | Dati account, cambia password, esporta dati |

### Sidebar attuale

- **Tutti**: Dashboard → Ferie → Avvisi → **Gestione Utenti** → Profilo (+ Tema, Esci).
- **Admin/Manager**: in più Approva Ferie, Gestione Avvisi.

**Problema**: un utente con ruolo “user” vede “Gestione Utenti” in menu; se ci clicca riceve “Accesso negato”. È confuso e poco professionale.

---

## 2. Problemi individuati

1. **Link admin visibili a tutti**  
   “Gestione Utenti” non è dentro il blocco `if (admin || manager)`, quindi tutti lo vedono.

2. **Troppe voci in fila per admin**  
   Per admin/manager la sidebar ha 7 link tutti sullo stesso livello: non si capisce che “Gestione Utenti”, “Approva Ferie”, “Gestione Avvisi” sono “area amministrazione”.

3. **Ordine poco guidato**  
   Manca una chiara distinzione tra: “uso quotidiano” (Dashboard, Ferie, Avvisi), “account” (Profilo), “amministrazione” (solo per chi può).

4. **Dashboard un po’ ripetitiva**  
   Le card “Gestione Ferie” e “Magazzino” ripetono funzioni già in menu (Ferie è già in sidebar). La dashboard potrebbe essere più “riepilogo” e meno “secondo menu”.

5. **Nessun orientamento nelle sotto-pagine**  
   In “Modifica avviso” o “Nuovo avviso” non è chiaro che sei dentro “Gestione Avvisi”. Un breadcrumb aiuterebbe (es. Dashboard > Gestione Avvisi > Modifica).

6. **Nomi non sempre chiari**  
   “Approva Ferie” è chiaro; “Gestione Avvisi” vs “Avvisi” può confondere (uno è lettura, l’altro è creazione/gestione). Una piccola etichetta o raggruppamento “Amministrazione” ridurrebbe l’ambiguità.

---

## 3. Consigli (cosa fare)

### A. Correzione immediata (priorità alta)

- **Nascondere “Gestione Utenti” ai non-admin**  
  Mostrare il link “Gestione Utenti” solo se `user.role === 'admin'` (e eventualmente manager, se nella vostra policy i manager gestiscono gli utenti).  
  Così l’utente normale non vede voci che non può usare e non arriva alla pagina 403.

- **Ordine logico in sidebar**  
  - Prima: **Dashboard** (casa / riepilogo).  
  - Poi: **Ferie**, **Avvisi** (lavoro quotidiano).  
  - Poi: **Profilo** (account).  
  - Infine, solo per admin/manager: **Gestione Utenti**, **Approva Ferie**, **Gestione Avvisi** (meglio se raggruppati visivamente, vedi sotto).

### B. Raggruppare le voci “Amministrazione”

- Aggiungere una **sezione “Amministrazione”** in sidebar (solo per admin/manager):
  - Un titolino/separatore: “Amministrazione” (testo più piccolo, colore attenuato).
  - Sotto: Gestione Utenti, Approva Ferie, Gestione Avvisi.
- In questo modo:
  - Le voci quotidiane (Dashboard, Ferie, Avvisi, Profilo) restano in cima e chiare.
  - Le tre schede admin sono chiaramente “un blocco” e non si confondono con il resto.

### C. Semplificare la Dashboard

- **Rimuovere o ridurre** le due card in basso (“Gestione Ferie” e “Magazzino”):
  - “Ferie” è già in sidebar; la card aggiunge poco.
  - “Magazzino” è “in arrivo”: si può tenere una sola card “In arrivo” generica o nasconderla finché il modulo non c’è.
- **Mantenere** (e eventualmente mettere in evidenza):
  - Riepilogo ferie (in attesa, approvate, giorni).
  - Ultimi avvisi (con link “Vai a Avvisi”).
  - Notifiche.
  - Ultime richieste ferie (con link “Vai a Ferie”).
- Obiettivo: **Dashboard = riepilogo + scorciatoie**, non secondo menu.

### D. Breadcrumb (opzionale ma utile)

- Nelle pagine “interne” mostrare un breadcrumb in alto, sotto il titolo:
  - Es. **Dashboard > Gestione Avvisi > Modifica avviso**
  - Es. **Dashboard > Ferie**
- Così l’utente capisce subito dove si trova e può tornare indietro con un click.

### E. Coerenza nomi e titoli

- **Avvisi** = “Avvisi” (lettura per tutti).
- **Gestione Avvisi** = “Gestione Avvisi” o “Avvisi (gestione)” (solo admin), possibilmente sotto la sezione “Amministrazione”.
- Titoli di pagina: mantenere sempre “Nome sezione - Portal-01” e, dove serve, un sottotitolo (es. “Modifica avviso”) per le sotto-pagine.

### F. Mobile

- La sidebar a tendina va bene; assicurarsi che l’ordine delle voci sia lo stesso (prima uso quotidiano, poi account, poi amministrazione).
- Evitare troppi livelli di menu: meglio una lista lunga ma lineare che menu a cascata su mobile, a meno che non si introduca un vero menu “Amministrazione” espandibile.

---

## 4. Riepilogo priorità (stato)

| Priorità | Intervento | Effetto | Stato |
|----------|------------|---------|--------|
| **Alta** | Nascondere “Gestione Utenti” ai non-admin | Niente più link che portano a 403 |
| **Alta** | Riordinare la sidebar (Dashboard, Ferie, Avvisi, Profilo, poi Admin) | Navigazione più logica | ✅ Fatto |
| **Media** | Sezione “Amministrazione” con titolo + 3 voci | Chiaro dove sono le funzioni admin |
| **Media** | Semplificare la dashboard (meno card, più riepilogo) | Meno rumore, uso più comodo | ✅ Fatto |
| **Bassa** | Breadcrumb nelle sotto-pagine | Orientamento migliore | ✅ Fatto |
| **Bassa** | Rinomare leggermente o raggruppare “Avvisi” vs “Gestione Avvisi” | Ancora più chiarezza |

---

## 5. Schema sidebar “dopo” (proposta)

**Utente (role user):**
1. Dashboard  
2. Ferie  
3. Avvisi  
4. Profilo  
5. (Tema)  
6. Esci  

**Admin / Manager:**
1. Dashboard  
2. Ferie  
3. Avvisi  
4. Profilo  
5. —— *Amministrazione* ——  
6. Gestione Utenti  
7. Approva Ferie  
8. Gestione Avvisi  
9. (Tema)  
10. Esci  

In questo modo le schede sono ordinate per uso (prima il quotidiano, poi l’account, poi l’amministrazione) e la gestione risulta più semplice e comoda.
