const express = require('express');

const AuthService = require('../services/AuthService');

const router = express.Router();

router.post('/register', (req, res, next) => {
  try {
    const result = AuthService.register(req.body.username, req.body.password);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

router.post('/login', (req, res, next) => {
  try {
    return res.json(AuthService.login(req.body.username, req.body.password));
  } catch (error) {
    return next(error);
  }
});

router.get('/me', (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
