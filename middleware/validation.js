const validator = require('validator');

function validateRegister(req, res, next) {
  const { username, email, password, full_name } = req.body || {};
  const err = [];
  if (!username || username.length < 3) err.push('Username almeno 3 caratteri');
  if (username && !/^[a-zA-Z0-9_]+$/.test(username)) err.push('Username solo lettere, numeri, underscore');
  if (!email || !validator.isEmail(email)) err.push('Email non valida');
  if (!password || password.length < 8) err.push('Password almeno 8 caratteri');
  if (password && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) err.push('Password: maiuscole, minuscole, numeri');
  if (!full_name || full_name.length < 2) err.push('Nome completo richiesto');
  if (err.length) return res.status(400).json({ error: err.join('. ') });
  next();
}

function validateLogin(req, res, next) {
  const { username, password } = req.body || {};
  if (!username) return res.status(400).json({ error: 'Username richiesto' });
  if (!password) return res.status(400).json({ error: 'Password richiesta' });
  next();
}

function validateFerie(req, res, next) {
  const { data_inizio, data_fine, tipo } = req.body || {};
  const err = [];
  if (!data_inizio) err.push('Data inizio richiesta');
  if (!data_fine) err.push('Data fine richiesta');
  if (data_inizio && data_fine) {
    const inizio = new Date(data_inizio);
    const fine = new Date(data_fine);
    const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
    if (inizio > fine) err.push('Data inizio prima della data fine');
    if (inizio < oggi) err.push('Non puoi richiedere ferie nel passato');
  }
  if (tipo && !['ferie', 'permesso', 'malattia'].includes(tipo)) err.push('Tipo non valido');
  if (err.length) return res.status(400).json({ error: err.join('. ') });
  next();
}

const PASSWORD_KEYS = ['password', 'current_password', 'new_password', 'confirm_password'];

function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(k => {
      if (typeof req.body[k] !== 'string') return;
      if (PASSWORD_KEYS.includes(k)) {
        req.body[k] = req.body[k].trim();
      } else {
        req.body[k] = validator.escape(req.body[k].trim());
      }
    });
  }
  next();
}

module.exports = { validateRegister, validateLogin, validateFerie, sanitizeInput };
