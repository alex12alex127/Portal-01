function log(level, msg, meta = {}) {
  const entry = {
    time: new Date().toISOString(),
    level,
    msg,
    ...meta
  };
  const out = process.env.NODE_ENV === 'production' ? JSON.stringify(entry) : `${entry.time} [${level}] ${msg} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
  if (level === 'error') console.error(out);
  else console.log(out);
}

module.exports = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta)
};
