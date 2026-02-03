FROM node:18-alpine

WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Installa dipendenze
RUN npm ci --only=production

# Copia il resto dei file
COPY . .

# Crea directory per logs
RUN mkdir -p logs

# Esponi porta
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/auth/login', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Avvia applicazione
CMD ["node", "server.js"]
