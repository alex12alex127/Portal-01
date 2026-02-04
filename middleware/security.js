const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('crypto');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Troppi tentativi. Riprova tra 15 minuti.' },
  standardHeaders: true,
  legacyHeaders: false
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Troppi tentativi di registrazione.' },
  standardHeaders: true,
  legacyHeaders: false
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
});

const CSRF_SKIP_METHODS = ['GET', 'HEAD', 'OPTIONS'];

function csrfProtection(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  if (CSRF_SKIP_METHODS.includes(req.method)) return next();
  const token = (req.body && req.body._csrf) || req.get('X-CSRF-Token');
  if (!token || token !== req.session.csrfToken) {
    const accept = req.headers.accept || '';
    if (accept.indexOf('json') !== -1) return res.status(403).json({ error: 'Token CSRF non valido' });
    return res.status(403).send('Accesso negato. Ricarica la pagina e riprova.');
  }
  next();
}

const loginAttempts = new Map();

function checkLoginAttempts(req, res, next) {
  const username = (req.body && req.body.username) || '';
  const ip = req.ip || '';
  const key = `${username}-${ip}`;
  const data = loginAttempts.get(key) || { count: 0, lockedUntil: null };
  if (data.lockedUntil && data.lockedUntil > Date.now()) {
    return res.status(429).json({ error: 'Account temporaneamente bloccato.' });
  }
  if (data.lockedUntil && data.lockedUntil <= Date.now()) loginAttempts.delete(key);
  req._loginKey = key;
  next();
}

function recordLoginAttempt(key, success) {
  if (success) {
    loginAttempts.delete(key);
    return;
  }
  const data = loginAttempts.get(key) || { count: 0, lockedUntil: null };
  data.count += 1;
  if (data.count >= 5) {
    data.lockedUntil = Date.now() + 30 * 60 * 1000;
    data.count = 0;
  }
  loginAttempts.set(key, data);
}

function logLoginAttempt(username, success, ip) {
  if (process.env.NODE_ENV === 'production') {
    console.log(`[${new Date().toISOString()}] Login ${success ? 'success' : 'fail'} ip=${ip}`);
  } else {
    console.log(`[${new Date().toISOString()}] Login ${username} success=${success} ip=${ip}`);
  }
}

module.exports = {
  loginLimiter,
  registerLimiter,
  apiLimiter,
  helmetConfig,
  csrfProtection,
  checkLoginAttempts,
  recordLoginAttempt,
  logLoginAttempt
};
