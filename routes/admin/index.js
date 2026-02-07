const express = require('express');
const router = express.Router();

router.use('/users', require('./users'));
router.use('/ferie', require('./ferie'));
router.use('/avvisi', require('./avvisi'));
router.use('/audit', require('./audit'));
router.use('/report', require('./report'));
router.use('/search', require('./search'));

module.exports = router;
