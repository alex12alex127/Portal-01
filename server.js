require('dotenv').config();
const express = require('express');
const compression = require('compression');
const session = require('express-session');
const path = require('path');
const db = require('./config/database');
const { helmetConfig, csrfProtection } = require('./middleware/security');
const { sanitizeInput } = require('./middleware/validation');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
app.use(compression());
app.use(helmetConfig);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: isProd ? '1d' : 0 }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
if (isProd) app.set('view cache', true);

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  },
  name: 'sessionId'
}));

app.use(csrfProtection);
app.use(sanitizeInput);

if (!isProd) {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/ferie', require('./routes/ferie'));
app.use('/profile', require('./routes/profile'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => {
  res.status(404);
  const accept = req.headers.accept || '';
  if (accept.indexOf('text/html') !== -1) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send('<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>404 - Portal-01</title><link rel="stylesheet" href="/css/style.css"></head><body><div class="container" style="padding:2rem;text-align:center"><h1>404</h1><p>Pagina non trovata.</p><a href="/" class="btn">Torna alla home</a></div></body></html>');
  } else {
    res.json({ error: 'Non trovato' });
  }
});

app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Errore server' : err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server in ascolto su porta ${PORT}`);
});

db.initDatabase()
  .then(() => console.log('Database pronto'))
  .catch((err) => {
    console.error('Database:', err.message);
    console.error('Imposta DATABASE_URL e riavvia. Vedi DOKPLOY-POSTGRES.md');
  });
