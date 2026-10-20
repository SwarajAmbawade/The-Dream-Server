const express = require('express');

const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/dreams', require('./dreams'));
router.use('/profile', require('./profile'));

module.exports = router;
