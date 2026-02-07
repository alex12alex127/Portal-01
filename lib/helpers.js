/**
 * Normalizza un valore data (Date, string, null) in stringa YYYY-MM-DD.
 */
function soloData(val) {
  if (val == null) return '';
  if (typeof val === 'string') return val.slice(0, 10);
  if (typeof val.toISOString === 'function') return val.toISOString().slice(0, 10);
  return String(val).slice(0, 10);
}

module.exports = { soloData };
