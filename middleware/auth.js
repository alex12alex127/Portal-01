// Middleware per autenticazione
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    const accept = req.headers.accept || '';
    if (req.xhr || accept.indexOf('json') > -1) {
      return res.status(401).json({ error: 'Non autorizzato' });
    }
    return res.redirect('/auth/login');
  }
  if (!req.session.user) {
    req.session.destroy(() => {});
    return res.redirect('/auth/login');
  }
  next();
};

// Middleware per ruoli
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Non autorizzato' });
    }
    
    if (!req.session.user || !roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Accesso negato' });
    }
    
    next();
  };
};

// Middleware per verificare che l'utente sia admin
const requireAdmin = requireRole('admin');

// Middleware per verificare che l'utente sia manager o admin
const requireManager = requireRole('admin', 'manager');

module.exports = {
  requireAuth,
  requireRole,
  requireAdmin,
  requireManager
};
