const translations = {
  it: {
    panoramica: 'Panoramica',
    ferie: 'Ferie',
    avvisi: 'Avvisi',
    notifiche: 'Notifiche',
    profilo: 'Profilo',
    impostazioni: 'Impostazioni',
    amministrazione: 'Amministrazione',
    gestione_utenti: 'Gestione Utenti',
    approva_ferie: 'Approva Ferie',
    gestione_avvisi: 'Gestione Avvisi',
    report_ferie: 'Report Ferie',
    audit_log: 'Audit Log',
    esci: 'Esci',
    cerca: 'Cerca...',
    salva: 'Salva',
    annulla: 'Annulla',
    conferma: 'Conferma',
    elimina: 'Elimina',
    modifica: 'Modifica',
    nuovo: 'Nuovo',
    nessun_risultato: 'Nessun risultato',
    errore_server: 'Errore del server',
    caricamento: 'Caricamento...',
    in_attesa: 'In attesa',
    approvata: 'Approvata',
    rifiutata: 'Rifiutata',
    data_inizio: 'Data inizio',
    data_fine: 'Data fine',
    giorni: 'Giorni',
    tipo: 'Tipo',
    stato: 'Stato',
    azioni: 'Azioni',
    permesso: 'Permesso',
    malattia: 'Malattia',
    note: 'Note',
    tema_chiaro: 'Tema chiaro',
    tema_scuro: 'Tema scuro',
    tema_auto: 'Automatico',
    lingua: 'Lingua',
    italiano: 'Italiano',
    inglese: 'English',
    benvenuto: 'Benvenuto',
    nessuna_notifica: 'Nessuna notifica.',
    nessun_avviso: 'Nessun avviso disponibile.',
    nessuna_richiesta: 'Nessuna richiesta.',
    richiesta_inviata: 'Richiesta inviata',
    profilo_aggiornato: 'Profilo aggiornato',
    password_cambiata: 'Password cambiata',
    impostazioni_salvate: 'Impostazioni salvate'
  },
  en: {
    panoramica: 'Overview',
    ferie: 'Leave',
    avvisi: 'Notices',
    notifiche: 'Notifications',
    profilo: 'Profile',
    impostazioni: 'Settings',
    amministrazione: 'Administration',
    gestione_utenti: 'User Management',
    approva_ferie: 'Approve Leave',
    gestione_avvisi: 'Notice Management',
    report_ferie: 'Leave Report',
    audit_log: 'Audit Log',
    esci: 'Logout',
    cerca: 'Search...',
    salva: 'Save',
    annulla: 'Cancel',
    conferma: 'Confirm',
    elimina: 'Delete',
    modifica: 'Edit',
    nuovo: 'New',
    nessun_risultato: 'No results',
    errore_server: 'Server error',
    caricamento: 'Loading...',
    in_attesa: 'Pending',
    approvata: 'Approved',
    rifiutata: 'Rejected',
    data_inizio: 'Start date',
    data_fine: 'End date',
    giorni: 'Days',
    tipo: 'Type',
    stato: 'Status',
    azioni: 'Actions',
    permesso: 'Permission',
    malattia: 'Sick leave',
    note: 'Notes',
    tema_chiaro: 'Light theme',
    tema_scuro: 'Dark theme',
    tema_auto: 'Automatic',
    lingua: 'Language',
    italiano: 'Italiano',
    inglese: 'English',
    benvenuto: 'Welcome',
    nessuna_notifica: 'No notifications.',
    nessun_avviso: 'No notices available.',
    nessuna_richiesta: 'No requests.',
    richiesta_inviata: 'Request submitted',
    profilo_aggiornato: 'Profile updated',
    password_cambiata: 'Password changed',
    impostazioni_salvate: 'Settings saved'
  }
};

function t(lang, key) {
  const dict = translations[lang] || translations.it;
  return dict[key] || translations.it[key] || key;
}

function i18nMiddleware(req, res, next) {
  // Default lingua
  let lang = 'it';
  // Se utente autenticato, prendi dalla sessione
  if (req.session && req.session.userLang) {
    lang = req.session.userLang;
  }
  res.locals.lang = lang;
  res.locals.t = function(key) { return t(lang, key); };
  next();
}

module.exports = { t, translations, i18nMiddleware };
