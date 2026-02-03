FROM node:18-alpine

WORKDIR /app

# Copia package.json
COPY package*.json ./

# Installa dipendenze
RUN npm install --production

# Copia il resto dei file
COPY . .

# Esponi porta
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/auth/login', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Avvia applicazione
CMD ["node", "server.js"]
