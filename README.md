# Portal-01 - Gestione Ferie

Webapp modulare per la gestione ferie con PostgreSQL, pronta per Dokploy.

## Struttura Modulare

```
Portal-01/
├── config/          # Configurazioni (database, etc)
├── routes/          # Route modulari (auth, ferie, etc)
├── views/           # Template EJS
├── public/          # File statici (CSS, JS)
└── server.js        # Entry point
```

## Setup Locale

1. Installa dipendenze:
```bash
npm install
```

2. Crea file `.env`:
```bash
cp .env.example .env
```

3. Configura DATABASE_URL nel file .env

4. Avvia:
```bash
npm start
```

## Deploy su Dokploy

1. Crea nuovo progetto su Dokploy
2. Collega repository Git
3. Configura variabili ambiente:
   - DATABASE_URL
   - SESSION_SECRET
   - NODE_ENV=production
4. Deploy automatico

## Moduli Futuri

- Dashboard avanzata
- Magazzino
- Altri moduli...
