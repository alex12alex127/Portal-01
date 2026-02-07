const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPLOAD_BASE = path.join(__dirname, '..', 'uploads');
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Crea un uploader multer per un modulo specifico.
 * @param {string} modulo - es. 'ferie', 'sicurezza', 'presenze'
 */
function createUploader(modulo) {
  const dir = path.join(UPLOAD_BASE, modulo);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, Date.now() + '-' + safe);
    }
  });

  return multer({
    storage,
    limits: { fileSize: MAX_SIZE },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, ALLOWED_EXTENSIONS.includes(ext));
    }
  });
}

/**
 * Restituisce il percorso completo di un file.
 */
function getFilePath(modulo, filename) {
  return path.join(UPLOAD_BASE, modulo, filename);
}

/**
 * Controlla se un file esiste.
 */
function fileExists(modulo, filename) {
  if (!filename) return false;
  return fs.existsSync(getFilePath(modulo, filename));
}

/**
 * Elimina un file.
 */
function deleteFile(modulo, filename) {
  if (!filename) return false;
  const fp = getFilePath(modulo, filename);
  if (fs.existsSync(fp)) {
    fs.unlinkSync(fp);
    return true;
  }
  return false;
}

module.exports = {
  createUploader,
  getFilePath,
  fileExists,
  deleteFile,
  UPLOAD_BASE,
  ALLOWED_EXTENSIONS,
  MAX_SIZE
};
