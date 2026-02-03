const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Rate limiting per login (previene brute force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 5, // max 5 tentativi
  message: { error: 'Troppi tentativi di login. Riprova tra 15 minuti.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting generale per API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 100, // max 100 richieste
  message: { error: 'Troppi richieste. Riprova più tardi.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting per registrazione
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 3, // max 3 registrazioni
  message: { error: 'Troppi tentativi di registrazione. Riprova tra 1 ora.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Configurazione Helmet per sicurezza headers
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Protezione CSRF semplice
const csrfProtection = (req, res, next) => {
  // Genera token CSRF se non esiste
  if (!req.session.csrfToken) {
    req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
  }
  
  res.locals.csrfToken = req.session.csrfToken;
  
  // Per richieste GET, passa oltre
  if (req.method === 'GET') {
    return next();
  }

  // Skip CSRF per ora (debug)
  // TODO: Riabilitare in produzione
  return next();
  
  // Verifica token CSRF per richieste POST/PUT/DELETE
  const token = req.body._csrf || req.headers['x-csrf-token'];
  
  if (!token || token !== req.session.csrfToken) {
    console.log(`[${new Date().toISOString()}] CSRF token mismatch - Expected: ${req.session.csrfToken}, Got: ${token}`);
    return res.status(403).json({ error: 'Token CSRF non valido' });
  }
  
  next();
};

// Logging tentativi di accesso
const logLoginAttempt = async (username, success, ip) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Login attempt - Username: ${username}, Success: ${success}, IP: ${ip}`);
  
  // Qui potresti salvare nel database per audit log
};

// Middleware per bloccare account dopo troppi tentativi falliti
const loginAttempts = new Map();

const checkLoginAttempts = (req, res, next) => {
  const { username } = req.body;
  const ip = req.ip;
  const key = `${username}-${ip}`;
  
  const attempts = loginAttempts.get(key) || { count: 0, lockedUntil: null };
  
  // Verifica se l'account è bloccato
  if (attempts.lockedUntil && attempts.lockedUntil > Date.now()) {
    const minutesLeft = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
    return res.status(429).json({ 
      error: `Account temporaneamente bloccato. Riprova tra ${minutesLeft} minuti.` 
    });
  }
  
  // Reset se il blocco è scaduto
  if (attempts.lockedUntil && attempts.lockedUntil <= Date.now()) {
    loginAttempts.delete(key);
  }
  
  req.loginAttemptsKey = key;
  next();
};

const recordLoginAttempt = (key, success) => {
  if (success) {
    loginAttempts.delete(key);
    return;
  }
  
  const attempts = loginAttempts.get(key) || { count: 0, lockedUntil: null };
  attempts.count += 1;
  
  // Blocca dopo 5 tentativi falliti per 30 minuti
  if (attempts.count >= 5) {
    attempts.lockedUntil = Date.now() + (30 * 60 * 1000);
    attempts.count = 0;
  }
  
  loginAttempts.set(key, attempts);
};

module.exports = {
  loginLimiter,
  apiLimiter,
  registerLimiter,
  helmetConfig,
  csrfProtection,
  logLoginAttempt,
  checkLoginAttempts,
  recordLoginAttempt
};
