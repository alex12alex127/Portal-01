const db = require('../config/database');

/**
 * Sistema di gestione avvisi professionale
 * Gestisce creazione, lettura, modifica, eliminazione avvisi
 */

class AnnouncementService {
  /**
   * Crea un nuovo avviso
   * @param {Object} avvisoData - Dati avviso
   * @param {number} avvisoData.created_by - ID utente che crea
   * @param {string} avvisoData.titolo - Titolo avviso
   * @param {string} avvisoData.contenuto - Contenuto avviso
   * @param {string} avvisoData.tipo - Tipo (info, warning, urgent, success)
   * @param {boolean} avvisoData.in_evidenza - Se in evidenza
   * @param {string|null} avvisoData.visibile_da - Data inizio visibilità
   * @param {string|null} avvisoData.visibile_fino - Data fine visibilità
   * @returns {Promise<Object>} Avviso creato
   */
  static async create(avvisoData) {
    try {
      const { created_by, titolo, contenuto, tipo = 'info', in_evidenza = false, visibile_da = null, visibile_fino = null } = avvisoData;
      
      if (!created_by || !titolo || !contenuto) {
        throw new Error('Campi obbligatori mancanti: created_by, titolo, contenuto');
      }

      const query = `
        INSERT INTO avvisi (created_by, titolo, contenuto, tipo, in_evidenza, visibile_da, visibile_fino, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id, created_by, titolo, contenuto, tipo, in_evidenza, visibile_da, visibile_fino, created_at
      `;
      
      const result = await db.query(query, [created_by, titolo, contenuto, tipo, in_evidenza, visibile_da, visibile_fino]);
      
      console.log(`[AnnouncementService] Avviso creato: ID ${result.rows[0].id} da utente ${created_by}`);
      return result.rows[0];
    } catch (error) {
      console.error('[AnnouncementService] Errore creazione avviso:', error);
      throw new Error(`Impossibile creare avviso: ${error.message}`);
    }
  }

  /**
   * Ottiene tutti gli avvisi visibili a un utente
   * @param {number|null} userId - ID utente (per check lettura)
   * @returns {Promise<Array>} Elenco avvisi visibili
   */
  static async getVisible(userId = null) {
    try {
      const oggi = new Date().toISOString().split('T')[0];
      
      let query = `
        SELECT a.*, u.full_name as autore_nome,
               CASE WHEN al.user_id IS NOT NULL THEN true ELSE false END as letto
        FROM avvisi a
        LEFT JOIN users u ON a.created_by = u.id
        LEFT JOIN avvisi_letti al ON a.id = al.avviso_id AND al.user_id = $1
        WHERE (a.visibile_da IS NULL OR a.visibile_da <= $2) 
          AND (a.visibile_fino IS NULL OR a.visibile_fino >= $2)
        ORDER BY a.in_evidenza DESC, a.created_at DESC
      `;
      
      const params = userId ? [userId, oggi] : [null, oggi];
      const result = await db.query(query, params);
      
      return result.rows;
    } catch (error) {
      console.error('[AnnouncementService] Errore caricamento avvisi visibili:', error);
      throw new Error(`Impossibile caricare avvisi: ${error.message}`);
    }
  }

  /**
   * Ottiene un avviso specifico
   * @param {number} id - ID avviso
   * @returns {Promise<Object|null>} Avviso trovato
   */
  static async getById(id) {
    try {
      if (!id) {
        throw new Error('ID avviso obbligatorio');
      }

      const query = `
        SELECT a.*, u.full_name as autore_nome
        FROM avvisi a
        LEFT JOIN users u ON a.created_by = u.id
        WHERE a.id = $1
      `;
      
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('[AnnouncementService] Errore caricamento avviso:', error);
      throw new Error(`Impossibile caricare avviso: ${error.message}`);
    }
  }

  /**
   * Aggiorna un avviso esistente
   * @param {number} id - ID avviso
   * @param {Object} updateData - Dati da aggiornare
   * @returns {Promise<Object>} Avviso aggiornato
   */
  static async update(id, updateData) {
    try {
      if (!id) {
        throw new Error('ID avviso obbligatorio');
      }

      const { titolo, contenuto, tipo, in_evidenza, visibile_da, visibile_fino } = updateData;
      
      const query = `
        UPDATE avvisi
        SET titolo = COALESCE($2, titolo),
            contenuto = COALESCE($3, contenuto),
            tipo = COALESCE($4, tipo),
            in_evidenza = COALESCE($5, in_evidenza),
            visibile_da = COALESCE($6, visibile_da),
            visibile_fino = COALESCE($7, visibile_fino),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, created_by, titolo, contenuto, tipo, in_evidenza, visibile_da, visibile_fino, created_at, updated_at
      `;
      
      const result = await db.query(query, [id, titolo, contenuto, tipo, in_evidenza, visibile_da, visibile_fino]);
      
      if (result.rows.length === 0) {
        throw new Error('Avviso non trovato');
      }

      console.log(`[AnnouncementService] Avviso ${id} aggiornato`);
      return result.rows[0];
    } catch (error) {
      console.error('[AnnouncementService] Errore aggiornamento avviso:', error);
      throw new Error(`Impossibile aggiornare avviso: ${error.message}`);
    }
  }

  /**
   * Elimina un avviso
   * @param {number} id - ID avviso
   * @returns {Promise<Object>} Avviso eliminato
   */
  static async delete(id) {
    try {
      if (!id) {
        throw new Error('ID avviso obbligatorio');
      }

      const query = `
        DELETE FROM avvisi
        WHERE id = $1
        RETURNING id, titolo, created_by
      `;
      
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        throw new Error('Avviso non trovato');
      }

      console.log(`[AnnouncementService] Avviso ${id} eliminato`);
      return result.rows[0];
    } catch (error) {
      console.error('[AnnouncementService] Errore eliminazione avviso:', error);
      throw new Error(`Impossibile eliminare avviso: ${error.message}`);
    }
  }

  /**
   * Marca un avviso come letto per un utente
   * @param {number} avvisoId - ID avviso
   * @param {number} userId - ID utente
   * @returns {Promise<boolean>} True se marcato con successo
   */
  static async markAsRead(avvisoId, userId) {
    try {
      if (!avvisoId || !userId) {
        throw new Error('AvvisoId e UserId obbligatori');
      }

      // Verifica che l'avviso esista e sia visibile
      const avviso = await this.getById(avvisoId);
      if (!avviso) {
        throw new Error('Avviso non trovato');
      }

      const oggi = new Date().toISOString().split('T')[0];
      if (avviso.visibile_da && avviso.visibile_da > oggi) {
        throw new Error('Avviso non ancora visibile');
      }
      if (avviso.visibile_fino && avviso.visibile_fino < oggi) {
        throw new Error('Avviso scaduto');
      }

      // Inserisci o aggiorna record di lettura
      const query = `
        INSERT INTO avvisi_letti (avviso_id, user_id, letto_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (avviso_id, user_id) 
        DO UPDATE SET letto_at = NOW()
        RETURNING avviso_id, user_id
      `;
      
      const result = await db.query(query, [avvisoId, userId]);
      
      console.log(`[AnnouncementService] Avviso ${avvisoId} marcato come letto da utente ${userId}`);
      return true;
    } catch (error) {
      console.error('[AnnouncementService] Errore marcatura avviso come letto:', error);
      throw new Error(`Impossibile marcare avviso come letto: ${error.message}`);
    }
  }

  /**
   * Conta gli avvisi non letti per un utente
   * @param {number} userId - ID utente
   * @returns {Promise<number>} Numero avvisi non letti
   */
  static async getUnreadCount(userId) {
    try {
      if (!userId) {
        throw new Error('UserID obbligatorio');
      }

      const oggi = new Date().toISOString().split('T')[0];
      
      const query = `
        SELECT COUNT(*) as count
        FROM avvisi a
        WHERE (a.visibile_da IS NULL OR a.visibile_da <= $1) 
          AND (a.visibile_fino IS NULL OR a.visibile_fino >= $1)
          AND NOT EXISTS (
            SELECT 1 FROM avvisi_letti al 
            WHERE al.avviso_id = a.id AND al.user_id = $2
          )
      `;
      
      const result = await db.query(query, [oggi, userId]);
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('[AnnouncementService] Errore conteggio avvisi non letti:', error);
      return 0;
    }
  }

  /**
   * Ottiene tutti gli avvisi (per admin)
   * @returns {Promise<Array>} Elenco tutti gli avvisi
   */
  static async getAll() {
    try {
      const query = `
        SELECT a.*, u.full_name as autore_nome
        FROM avvisi a
        LEFT JOIN users u ON a.created_by = u.id
        ORDER BY a.in_evidenza DESC, a.created_at DESC
      `;
      
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      console.error('[AnnouncementService] Errore caricamento tutti avvisi:', error);
      throw new Error(`Impossibile caricare avvisi: ${error.message}`);
    }
  }
}

// Funzioni helper per compatibilità con codice esistente
async function creaAvviso(avvisoData) {
  return await AnnouncementService.create(avvisoData);
}

async function getAvvisiVisibili(userId) {
  return await AnnouncementService.getVisible(userId);
}

async function getAvviso(id) {
  return await AnnouncementService.getById(id);
}

async function aggiornaAvviso(id, updateData) {
  return await AnnouncementService.update(id, updateData);
}

async function eliminaAvviso(id) {
  return await AnnouncementService.delete(id);
}

async function marcaAvvisoComeLetto(avvisoId, userId) {
  return await AnnouncementService.markAsRead(avvisoId, userId);
}

async function contaAvvisiNonLetti(userId) {
  return await AnnouncementService.getUnreadCount(userId);
}

module.exports = {
  AnnouncementService,
  creaAvviso,
  getAvvisiVisibili,
  getAvviso,
  aggiornaAvviso,
  eliminaAvviso,
  marcaAvvisoComeLetto,
  contaAvvisiNonLetti
};
