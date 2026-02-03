# Come Generare package-lock.json

## 🔧 Problema
Docker build fallisce perché manca `package-lock.json`

## ✅ Soluzione

### Opzione 1: Genera Localmente (Consigliato)

Apri **CMD** (non PowerShell) nella cartella Portal-01:

```cmd
cd Portal-01
npm install
```

Questo creerà il file `package-lock.json`.

Poi fai commit e push:
```cmd
git add package-lock.json
git commit -m "Add package-lock.json"
git push
```

---

### Opzione 2: Usa il Dockerfile Aggiornato

Ho già aggiornato il Dockerfile per usare `npm install` invece di `npm ci`.

Questo funziona anche senza `package-lock.json`, ma è meno ottimale.

---

### Opzione 3: Crea package-lock.json Manualmente

Se non riesci a eseguire npm localmente, puoi:

1. Fai il primo deploy su Dokploy (fallirà ma va bene)
2. Apri la console Dokploy
3. Esegui:
```bash
cd /app
npm install
cat package-lock.json
```
4. Copia l'output
5. Crea il file `package-lock.json` localmente con quel contenuto
6. Fai commit e push

---

## 📋 Verifica

Dopo aver generato `package-lock.json`, verifica che esista:

```cmd
dir package-lock.json
```

Dovresti vedere il file nella lista.

---

## 🚀 Deploy

Una volta che hai `package-lock.json`:

1. Fai commit:
```cmd
git add package-lock.json
git commit -m "Add package-lock.json"
git push
```

2. Dokploy farà automaticamente il redeploy

3. Il build dovrebbe completarsi con successo

---

## ⚠️ Nota

Il Dockerfile è già stato aggiornato per funzionare anche senza `package-lock.json`, quindi il deploy dovrebbe funzionare ora.

Ma è meglio avere `package-lock.json` per:
- Build più veloci
- Versioni dipendenze consistenti
- Migliore cache Docker
