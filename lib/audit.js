const db = require('../config/database');
const logger = require('./logger');

async function logAudit(userId, azione, dettaglio = null, ip = null) {
  try {
    await db.query(
      'INSERT INTO audit_log (user_id, azione, dettaglio, ip) VALUES ($1, $2, $3, $4)',
      [userId || null, azione, dettaglio ? String(dettaglio).slice(0, 1000) : null, ip || null]
    );
  } catch (err) {
    logger.error('Audit log failed', { err: err.message, azione });
  }
}

module.exports = { logAudit };
