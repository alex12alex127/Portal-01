const validator = require('validator');

// Validazione registrazione
const validateRegister = (req, res, next) => {
  const { username, email, password, full_name } = req.body;
  const errors = [];

  // Username
  if (!username || username.length < 3) {
    errors.push('Username deve essere almeno 3 caratteri');
  }
  if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('Username può contenere solo lettere, numeri e underscore');
  }

  // Email
  if (!email || !validator.isEmail(email)) {
    errors.push('Email non valida');
  }

  // Password
  if (!password || password.length < 8) {
    errors.push('Password deve essere almeno 8 caratteri');
  }
  if (password && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    errors.push('Password deve contenere maiuscole, minuscole e numeri');
  }

  // Nome completo
  if (!full_name || full_name.length < 2) {
    errors.push('Nome completo richiesto');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') });
  }

  next();
};

// Validazione login
const validateLogin = (req, res, next) => {
  const { username, password } = req.body;
  const errors = [];

  if (!username) {
    errors.push('Username richiesto');
  }

  if (!password) {
    errors.push('Password richiesta');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') });
  }

  next();
};

// Validazione richiesta ferie
const validateFerie = (req, res, next) => {
  const { data_inizio, data_fine, tipo } = req.body;
  const errors = [];

  if (!data_inizio) {
    errors.push('Data inizio richiesta');
  }

  if (!data_fine) {
    errors.push('Data fine richiesta');
  }

  if (data_inizio && data_fine) {
    const inizio = new Date(data_inizio);
    const fine = new Date(data_fine);
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);

    if (inizio > fine) {
      errors.push('Data inizio deve essere prima della data fine');
    }
    if (inizio < oggi) {
      errors.push('Non puoi richiedere ferie nel passato');
    }
  }

  const tipiValidi = ['ferie', 'permesso', 'malattia'];
  if (tipo && !tipiValidi.includes(tipo)) {
    errors.push('Tipo non valido');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') });
  }

  next();
};

// Sanitizzazione input
const sanitizeInput = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = validator.escape(req.body[key].trim());
      }
    });
  }
  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateFerie,
  sanitizeInput
};
