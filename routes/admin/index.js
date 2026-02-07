const express = require('express');
const router = express.Router();

router.use('/users', require('./users'));
router.use('/ferie', require('./ferie'));
router.use('/avvisi', require('./avvisi'));
router.use('/audit', require('./audit'));
router.use('/report', require('./report'));
router.use('/sicurezza', require('./sicurezza'));
router.use('/festivita', require('./festivita'));
router.use('/impostazioni', require('./impostazioni'));
router.use('/reparti', require('./reparti'));
router.use('/budget-ferie', require('./budget_ferie'));
router.use('/presenze', require('./presenze'));
router.use('/search', require('./search'));

module.exports = router;
