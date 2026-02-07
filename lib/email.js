const db = require('../config/database');

async function sendFerieEmail(userId, stato, dataInizio, dataFine, commento) {
  if (!process.env.SMTP_HOST) return;
  try {
    const userResult = await db.query('SELECT email, full_name FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) return;
    const { email, full_name } = userResult.rows[0];
    const nodemailer = require('nodemailer');
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });
    const subject = `Portal-01 - Richiesta ferie ${stato}`;
    let text = `Ciao ${full_name},\n\nLa tua richiesta di ferie dal ${dataInizio} al ${dataFine} è stata ${stato}.`;
    if (commento) text += `\n${stato === 'rifiutata' ? 'Motivo' : 'Nota'}: ${commento}`;
    text += '\n\nPortal-01';
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject,
      text
    });
  } catch (err) {
    console.error('[sendFerieEmail]', err.message);
  }
}

module.exports = { sendFerieEmail };
