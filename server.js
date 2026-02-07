require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const compression = require('compression');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const db = require('./config/database');
const { helmetConfig, csrfProtection } = require('./middleware/security');
const { sanitizeInput } = require('./middleware/validation');
const { addGlobalCounts } = require('./middleware/global');
const { i18nMiddleware } = require('./lib/i18n');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/+$/, ''); // es. '' o '/portal'

app.set('trust proxy', 1);
app.set('basePath', BASE_PATH);
app.use(compression());
app.use(helmetConfig);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static e route sotto BASE_PATH così funziona anche con proxy (es. app in /portal/)
app.use(BASE_PATH || '/', express.static(path.join(__dirname, 'public'), { maxAge: isProd ? '1d' : 0 }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/app');
if (isProd) app.set('view cache', true);

const sessionOpts = {
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
};
if (process.env.DATABASE_URL) {
  sessionOpts.store = new pgSession({ pool: db.pool, tableName: 'session' });
}
app.use(session(sessionOpts));

app.use(csrfProtection);
app.use(sanitizeInput);

// Base path per view e redirect
app.use((req, res, next) => {
  res.locals.basePath = BASE_PATH;
  next();
});

// Normalizza trailing slash (evita 404 su mobile quando il browser richiede es. /dashboard/)
app.use((req, res, next) => {
  if (req.path.length > 1 && req.path.endsWith('/')) {
    const target = req.path.slice(0, -1) + (req.url.slice(req.path.length) || '');
    return res.redirect(301, target);
  }
  next();
});

app.use((req, res, next) => {
  if (req.session && req.session.user) res.locals.user = req.session.user;
  next();
});

// Middleware per conteggi globali (dopo session, prima routes)
app.use(addGlobalCounts);

// Middleware i18n (dopo session)
app.use(i18nMiddleware);

if (!isProd) {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}${req.path !== req.originalUrl ? ' (original: ' + req.originalUrl + ')' : ''}`);
    next();
  });
}

app.use(BASE_PATH || '/', require('./routes/index'));
app.use(BASE_PATH + '/auth', require('./routes/auth'));
app.use(BASE_PATH + '/ferie', require('./routes/ferie'));
app.use(BASE_PATH + '/avvisi', require('./routes/avvisi'));
app.use(BASE_PATH + '/profile', require('./routes/profile'));
app.use(BASE_PATH + '/admin', require('./routes/admin'));
app.use(BASE_PATH + '/notifiche', require('./routes/notifiche'));
app.use(BASE_PATH + '/api/v1', require('./routes/api'));

app.use((req, res) => {
  const requestPath = req.originalUrl || req.url || req.path;
  if (!isProd) console.warn('[404]', req.method, requestPath, 'Host:', req.get('Host'));
  res.status(404);
  const accept = (req.headers.accept || '').toLowerCase();
  const wantsHtml = accept.indexOf('text/html') !== -1 || accept.indexOf('*/*') !== -1;
  if (wantsHtml) {
    res.render('404', { title: '404 - Portal-01', layout: 'layouts/app', basePath: BASE_PATH }, (renderErr, html) => {
      if (renderErr) {
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.send('<!DOCTYPE html><html><body><h1>404</h1><p>Pagina non trovata.</p></body></html>');
      } else {
        res.send(html);
      }
    });
  } else {
    res.json({ error: 'Non trovato', path: requestPath });
  }
});

function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

app.use((err, req, res, _next) => {
  console.error('[Error]', err);
  res.status(500);
  const accept = (req.headers.accept || '').toLowerCase();
  if (accept.indexOf('text/html') !== -1) {
    res.render('500', { title: 'Errore - Portal-01', basePath: req.app.get('basePath') || '' }, (renderErr, html) => {
      if (renderErr) res.send('Errore del server.');
      else res.send(html || 'Errore del server.');
    });
  } else {
    res.json({ error: process.env.NODE_ENV === 'production' ? 'Errore server' : err.message });
  }
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
