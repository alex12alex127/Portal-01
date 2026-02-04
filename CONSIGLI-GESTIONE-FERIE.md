# Consigli per la sezione Gestione Ferie

Suggerimenti basati sull’analisi dell’app e sulle lacune (ANALISI-APP-LACUNE.md), ordinati per priorità.

---

## Priorità alta (impatto utente e processo)

### 1. Modifica / ritiro richiesta (solo se in attesa)
- **Ora:** Una volta inviata, la richiesta non si può più modificare o cancellare.
- **Consiglio:** Per le richieste con stato **In attesa**, mostrare in ogni card un pulsante **Modifica** e uno **Ritira**. Modifica apre un form (stesso form della nuova richiesta, precompilato) e salva con PUT/PATCH; Ritira imposta stato a `rejected` o aggiunge uno stato `withdrawn`. Route es. `PUT /ferie/:id`, `POST /ferie/:id/withdraw`.

### 2. Notifiche quando la richiesta viene approvata/rifiutata
- **Ora:** L’utente deve entrare in “Le mie richieste” per vedere se è stata approvata/rifiutata.
- **Consiglio:** Quando un admin/manager approva o rifiuta, inviare un’email all’utente (o, in alternativa, una notifica in-app nella dashboard). Così l’utente è informato senza dover controllare a mano.

### 3. Conteggio giorni “lavorativi” (opzionale ma molto utile)
- **Ora:** I giorni sono calcolati come differenza tra data fine e data inizio + 1 (tutti i giorni, inclusi weekend).
- **Consiglio:** Offrire (anche solo in backend) il calcolo **solo giorni lavorativi** (escludendo sabato/domenica e, se serve, una tabella festivi). Mostrare in interfaccia “X giorni (lavorativi)” o “X giorni (compresi weekend)” a seconda della policy aziendale.

---

## Priorità media (UX e controllo)

### 4. Filtri nella lista “Le mie richieste”
- **Ora:** Vengono mostrate tutte le richieste in ordine di data.
- **Consiglio:** Aggiungere filtri rapidi: **Stato** (Tutte / In attesa / Approvate / Rifiutate), **Anno**, eventualmente **Tipo** (ferie/permesso/malattia). Su mobile possono essere dropdown o chip cliccabili sopra la lista.

### 5. Limite giorni per richiesta / per anno
- **Ora:** Si può richiedere un numero qualsiasi di giorni.
- **Consiglio:** Configurare (es. in config o DB) un massimo di giorni per singola richiesta e un massimo annuo per utente. In validazione backend rifiutare se si supera; in frontend mostrare un messaggio tipo “Hai già usato X di Y giorni disponibili quest’anno” (se carichi il totale dalla dashboard o da un endpoint).

### 6. Riepilogo in testa alla pagina
- **Ora:** Solo form, lista e calendario.
- **Consiglio:** In cima alla sezione (sopra o sotto il titolo) un piccolo riepilogo: **Giorni richiesti quest’anno**, **In attesa**, **Approvati**, **Rifiutati**. Su mobile può essere una riga compatta o due; su desktop una piccola strip con 4 numeri. Dati già disponibili dalla lista ferie (calcolabili lato client o con un endpoint `/ferie/summary`).

### 7. Calendario: evidenziare le tue ferie approvate
- **Ora:** Il calendario mostra “chi è in ferie” in generale (tutti i dipendenti).
- **Consiglio:** Evidenziare in modo diverso i giorni in cui **tu** sei in ferie (es. bordo più marcato o colore diverso), così l’utente vede subito i propri periodi approvati nel calendario.

---

## Priorità bassa (nice-to-have)

### 8. Export / stampa
- Consentire **export CSV** o **stampa** delle “Mie richieste” (o del riepilogo anno) per uso personale o documentale.

### 9. Date “bloccate” o policy aziendali
- Se l’azienda vieta ferie in certi periodi, gestire una lista di date o intervalli bloccati e in validazione (e in frontend) impedire di richiedere ferie in quei periodi, con messaggio chiaro.

### 10. Calendario: vista “lista” oltre alla griglia
- Su mobile, sotto il calendario, una **lista dei giorni del mese con ferie** (es. “5 gen: Mario, Luca”) per chi preferisce leggere invece di cliccare sulle celle.

---

## Piccoli miglioramenti UI/UX (già coerenti con il resto)

- **Messaggio sovrapposizione:** Quando il backend risponde “Hai già una richiesta per questo periodo”, mostrarlo in evidenza sotto il form (già previsto con `#ferieMsg` e `message-error`).
- **Conferma prima di invio:** Opzionale: modale “Confermi l’invio di X giorni di ferie da … a …?” prima del submit, per evitare errori di battitura.
- **Placeholder date:** Nel form, placeholder o hint “Seleziona data inizio e fine” se i campi sono vuoti (già migliorabile con `placeholder` o testo di aiuto).
- **Ordine lista:** Mantenere “Le mie richieste” ordinate per data inizio decrescente (più recenti sopra); è già così. Opzionale: ordinamento per stato (es. prima “In attesa”) tramite filtro.

---

## Riepilogo per dove intervenire

| Intervento                    | Dove (route / view)           | Difficoltà |
|------------------------------|-------------------------------|------------|
| Modifica/ritiro richiesta    | `routes/ferie.js`, view       | Media      |
| Notifiche approvazione/rifiuto | `routes/admin.js` + email  | Media      |
| Giorni lavorativi             | `routes/ferie.js` (calcolo)  | Media      |
| Filtri lista                  | `routes/ferie.js` (query), view | Bassa   |
| Limiti giorni                 | config + validazione + view  | Media      |
| Riepilogo in testa            | view + eventuale GET summary | Bassa      |
| Calendario “le tue” ferie     | view + dati già in calendar  | Bassa      |

Se vuoi, il passo successivo può essere implementare una sola voce (es. **modifica/ritiro richiesta** o **filtri lista**) e adattare il codice passo passo.
