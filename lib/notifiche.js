const db = require('../config/database');

/**
 * Sistema di gestione notifiche professionale
 * Gestisce creazione, lettura, eliminazione notifiche utente
 */

class NotificationService {
  /**
   * Crea una nuova notifica per un utente
   * @param {number} userId - ID dell'utente
   * @param {string} tipo - Tipo notifica (ferie_create, ferie_approvata, etc.)
   * @param {string} titolo - Titolo della notifica
   * @param {string|null} messaggio - Messaggio dettagliato (opzionale)
   * @returns {Promise<Object>} Notifica creata
   */
  static async create(userId, tipo, titolo, messaggio = null) {
    try {
      if (!userId || !tipo || !titolo) {
        throw new Error('Parametri obbligatori mancanti: userId, tipo, titolo');
      }

      const query = `
        INSERT INTO notifiche (user_id, tipo, titolo, messaggio, letta, created_at)
        VALUES ($1, $2, $3, $4, false, NOW())
        RETURNING id, user_id, tipo, titolo, messaggio, letta, created_at
      `;
      
      const result = await db.query(query, [userId, tipo, titolo, messaggio]);
      
      console.log(`[NotificationService] Notifica creata: ID ${result.rows[0].id} per utente ${userId}`);
      return result.rows[0];
    } catch (error) {
      console.error('[NotificationService] Errore creazione notifica:', error);
      throw new Error(`Impossibile creare notifica: ${error.message}`);
    }
  }

  /**
   * Ottiene tutte le notifiche di un utente
   * @param {number} userId - ID dell'utente
   * @param {number} limit - Limite risultati (default 20)
   * @returns {Promise<Array>} Elenco notifiche
   */
  static async getUserNotifications(userId, limit = 20) {
    try {
      if (!userId) {
        throw new Error('UserID obbligatorio');
      }

      const query = `
        SELECT id, tipo, titolo, messaggio, letta, created_at
        FROM notifiche
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;
      
      const result = await db.query(query, [userId, limit]);
      return result.rows;
    } catch (error) {
      console.error('[NotificationService] Errore caricamento notifiche utente:', error);
      throw new Error(`Impossibile caricare notifiche: ${error.message}`);
    }
  }

  /**
   * Conta le notifiche non lette di un utente
   * @param {number} userId - ID dell'utente
   * @returns {Promise<number>} Numero notifiche non lette
   */
  static async getUnreadCount(userId) {
    try {
      if (!userId) {
        throw new Error('UserID obbligatorio');
      }

      const query = `
        SELECT COUNT(*) as count
        FROM notifiche
        WHERE user_id = $1 AND letta = false
      `;
      
      const result = await db.query(query, [userId]);
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('[NotificationService] Errore conteggio notifiche non lette:', error);
      return 0;
    }
  }

  /**
   * Marca una notifica come letta
   * @param {number} notificationId - ID della notifica
   * @param {number} userId - ID dell'utente (per verifica sicurezza)
   * @returns {Promise<Object>} Notifica aggiornata
   */
  static async markAsRead(notificationId, userId) {
    try {
      if (!notificationId || !userId) {
        throw new Error('NotificationId e UserId obbligatori');
      }

      const query = `
        UPDATE notifiche
        SET letta = true
        WHERE id = $1 AND user_id = $2 AND letta = false
        RETURNING id, user_id, tipo, titolo, letta, created_at
      `;
      
      const result = await db.query(query, [notificationId, userId]);
      
      if (result.rows.length === 0) {
        throw new Error('Notifica non trovata, già letta, o non autorizzata');
      }

      console.log(`[NotificationService] Notifica ${notificationId} marcata come letta`);
      return result.rows[0];
    } catch (error) {
      console.error('[NotificationService] Errore marcatura notifica:', error);
      throw new Error(`Impossibile marcare notifica come letta: ${error.message}`);
    }
  }

  /**
   * Marca tutte le notifiche di un utente come lette
   * @param {number} userId - ID dell'utente
   * @returns {Promise<number>} Numero di notifiche aggiornate
   */
  static async markAllAsRead(userId) {
    try {
      if (!userId) {
        throw new Error('UserID obbligatorio');
      }

      const query = `
        UPDATE notifiche
        SET letta = true
        WHERE user_id = $1 AND letta = false
        RETURNING COUNT(*) as updated
      `;
      
      const result = await db.query(query, [userId]);
      const updatedCount = parseInt(result.rows[0].updated);
      
      console.log(`[NotificationService] ${updatedCount} notifiche marcate come lette per utente ${userId}`);
      return updatedCount;
    } catch (error) {
      console.error('[NotificationService] Errore marcatura tutte notifiche:', error);
      throw new Error(`Impossibile marcare tutte le notifiche: ${error.message}`);
    }
  }

  /**
   * Elimina una notifica
   * @param {number} notificationId - ID della notifica
   * @param {number} userId - ID dell'utente (per verifica sicurezza)
   * @returns {Promise<Object>} Notifica eliminata
   */
  static async delete(notificationId, userId) {
    try {
      if (!notificationId || !userId) {
        throw new Error('NotificationId e UserId obbligatori');
      }

      const query = `
        DELETE FROM notifiche
        WHERE id = $1 AND user_id = $2
        RETURNING id, user_id, tipo, titolo
      `;
      
      const result = await db.query(query, [notificationId, userId]);
      
      if (result.rows.length === 0) {
        throw new Error('Notifica non trovata o non autorizzata');
      }

      console.log(`[NotificationService] Notifica ${notificationId} eliminata`);
      return result.rows[0];
    } catch (error) {
      console.error('[NotificationService] Errore eliminazione notifica:', error);
      throw new Error(`Impossibile eliminare notifica: ${error.message}`);
    }
  }

  /**
   * Elimina tutte le notifiche di un utente
   * @param {number} userId - ID dell'utente
   * @returns {Promise<number>} Numero di notifiche eliminate
   */
  static async deleteAll(userId) {
    try {
      if (!userId) {
        throw new Error('UserID obbligatorio');
      }

      const query = `
        DELETE FROM notifiche
        WHERE user_id = $1
        RETURNING COUNT(*) as deleted
      `;
      
      const result = await db.query(query, [userId]);
      const deletedCount = parseInt(result.rows[0].deleted);
      
      console.log(`[NotificationService] ${deletedCount} notifiche eliminate per utente ${userId}`);
      return deletedCount;
    } catch (error) {
      console.error('[NotificationService] Errore eliminazione tutte notifiche:', error);
      throw new Error(`Impossibile eliminare tutte le notifiche: ${error.message}`);
    }
  }
}

// Funzioni helper per compatibilità con codice esistente
async function creaNotifica(userId, tipo, titolo, messaggio) {
  return await NotificationService.create(userId, tipo, titolo, messaggio);
}

async function getNotificheUtente(userId, limit) {
  return await NotificationService.getUserNotifications(userId, limit);
}

async function contaNotificheNonLette(userId) {
  return await NotificationService.getUnreadCount(userId);
}

async function marcaNotificaComeLetta(notificationId, userId) {
  return await NotificationService.markAsRead(notificationId, userId);
}

async function marcaTutteComeLette(userId) {
  return await NotificationService.markAllAsRead(userId);
}

async function eliminaNotifica(notificationId, userId) {
  return await NotificationService.delete(notificationId, userId);
}

module.exports = {
  NotificationService,
  creaNotifica,
  getNotificheUtente,
  contaNotificheNonLette,
  marcaNotificaComeLetta,
  marcaTutteComeLette,
  eliminaNotifica
};
