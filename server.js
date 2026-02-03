require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./config/database');
const { helmetConfig, csrfProtection } = require('./middleware/security');
const { sanitizeInput } = require('./middleware/validation');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (importante per Dokploy/reverse proxy)
app.set('trust proxy', 1);

// Security headers
app.use(helmetConfig);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 ore
    sameSite: 'strict'
  },
  name: 'sessionId' // Nome custom per nascondere che usiamo express-session
}));

// CSRF Protection
app.use(csrfProtection);

// Sanitizzazione input
app.use(sanitizeInput);

// Logging richieste
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/ferie', require('./routes/ferie'));
app.use('/profile', require('./routes/profile'));
app.use('/admin', require('./routes/admin'));

// 404 Handler
app.use((req, res) => {
  res.status(404);
  const acceptsHtml = (req.headers.accept || '').indexOf('text/html') !== -1;
  if (acceptsHtml) {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>404 - Portal-01</title><link rel="stylesheet" href="/css/style.css"></head><body><div class="container" style="padding:2rem;text-align:center"><h1>404</h1><p>Pagina non trovata.</p><a href="/" class="btn">Torna alla home</a></div></body></html>`);
  } else {
    res.json({ error: 'Risorsa non trovata' });
  }
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error:`, err);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Errore del server' 
      : err.message 
  });
});

// Avvia subito il server (così il proxy non dà 502), poi init DB in background
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
});

db.initDatabase()
  .then(() => {
    console.log('✓ Database initialized');
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    console.error('L\'app resta in ascolto ma le pagine che usano il DB potrebbero dare errore.');
  });
