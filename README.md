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

5. Crea account admin:
```bash
npm run create-admin
```

## Account di Default

Dopo aver eseguito `npm run create-admin`:

- **Admin**: username: `admin`, password: `Admin123!`
- **Manager**: username: `manager`, password: `Manager123!`
- **User**: username: `user`, password: `User123!`

⚠️ Cambia queste password in produzione!

## Deploy (Git + Dokploy o altro)

L’app è pronta per il deploy: dopo il push su Git, la piattaforma può buildare l’immagine dal `Dockerfile` e avviare con `npm start`. Il server ascolta su `0.0.0.0` e usa `PORT` dalle variabili d’ambiente.

1. Push del repository su GitHub/GitLab
2. Su Dokploy: nuovo progetto → collega repo Git
3. Variabili ambiente obbligatorie:
   - `DATABASE_URL` (PostgreSQL)
   - `SESSION_SECRET`
   - `NODE_ENV=production`
4. Dopo il primo deploy, dalla console esegui: `npm run create-admin`

## Moduli Futuri

- Dashboard avanzata
- Magazzino
- Altri moduli...
