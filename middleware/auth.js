function requireAuth(req, res, next) {
  const base = req.app.get('basePath') || '';
  if (!req.session.user) {
    const accept = req.headers.accept || '';
    if (accept.indexOf('json') !== -1) return res.status(401).json({ error: 'Non autorizzato' });
    return res.redirect(base + '/auth/login');
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user || !roles.includes(req.session.user.role)) {
      const accept = (req.headers.accept || '').toLowerCase();
      if (accept.indexOf('text/html') !== -1) {
        return res.status(403).render('403', { title: 'Accesso negato - Portal-01' });
      }
      return res.status(403).json({ error: 'Accesso negato' });
    }
    next();
  };
}

const requireAdmin = requireRole('admin');
const requireManager = requireRole('admin', 'manager');

module.exports = { requireAuth, requireRole, requireAdmin, requireManager };
