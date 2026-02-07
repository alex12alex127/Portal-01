/**
 * Sistema di permessi centralizzato.
 * Definisce quali azioni ogni ruolo può compiere.
 */

const PERMISSIONS = {
  // Gestione utenti
  'users.view':       ['admin'],
  'users.create':     ['admin'],
  'users.edit':       ['admin'],
  'users.delete':     ['admin'],

  // Ferie
  'ferie.create':     ['user', 'manager', 'admin'],
  'ferie.view_own':   ['user', 'manager', 'admin'],
  'ferie.view_all':   ['manager', 'admin'],
  'ferie.approve':    ['manager', 'admin'],
  'ferie.reject':     ['manager', 'admin'],
  'ferie.edit_all':   ['manager', 'admin'],
  'ferie.delete':     ['manager', 'admin'],
  'ferie.export':     ['manager', 'admin'],

  // Budget ferie
  'budget.view_own':  ['user', 'manager', 'admin'],
  'budget.view_all':  ['manager', 'admin'],
  'budget.edit':      ['admin'],

  // Avvisi
  'avvisi.view':      ['user', 'manager', 'admin'],
  'avvisi.create':    ['manager', 'admin'],
  'avvisi.edit':      ['manager', 'admin'],
  'avvisi.delete':    ['manager', 'admin'],

  // Notifiche
  'notifiche.view':   ['user', 'manager', 'admin'],

  // Sicurezza
  'sicurezza.view_own':  ['user', 'manager', 'admin'],
  'sicurezza.view_all':  ['admin'],
  'sicurezza.edit':      ['admin'],

  // Presenze
  'presenze.view_own':   ['user', 'manager', 'admin'],
  'presenze.timbra':     ['user', 'manager', 'admin'],
  'presenze.view_all':   ['manager', 'admin'],
  'presenze.edit':       ['manager', 'admin'],
  'presenze.export':     ['manager', 'admin'],

  // Reparti
  'reparti.view':     ['manager', 'admin'],
  'reparti.edit':     ['admin'],

  // Impostazioni
  'impostazioni.view': ['admin'],
  'impostazioni.edit': ['admin'],

  // Festività
  'festivita.view':   ['manager', 'admin'],
  'festivita.edit':   ['manager', 'admin'],

  // Audit
  'audit.view':       ['admin'],

  // Report
  'report.view':      ['admin'],
  'report.export':    ['admin'],
};

/**
 * Controlla se un ruolo ha un determinato permesso.
 */
function hasPermission(role, permission) {
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}

/**
 * Restituisce tutti i permessi per un ruolo.
 */
function getPermissionsForRole(role) {
  const perms = [];
  for (const [perm, roles] of Object.entries(PERMISSIONS)) {
    if (roles.includes(role)) perms.push(perm);
  }
  return perms;
}

/**
 * Middleware Express: richiede un permesso specifico.
 * Usage: router.get('/path', requirePermission('ferie.approve'), handler)
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Non autenticato' });
    }
    if (!hasPermission(req.session.user.role, permission)) {
      const accept = (req.headers.accept || '').toLowerCase();
      if (accept.includes('application/json') || req.xhr) {
        return res.status(403).json({ error: 'Permesso negato' });
      }
      return res.status(403).render('403', {
        title: '403 - Accesso negato',
        basePath: req.app.get('basePath') || ''
      });
    }
    next();
  };
}

/**
 * Helper per le views: controlla permesso utente corrente.
 */
function canUser(user, permission) {
  if (!user || !user.role) return false;
  return hasPermission(user.role, permission);
}

module.exports = {
  PERMISSIONS,
  hasPermission,
  getPermissionsForRole,
  requirePermission,
  canUser
};
