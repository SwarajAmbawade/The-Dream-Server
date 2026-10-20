const express = require('express');

const db = require('../db/database');
const Dream = require('../models/Dream');
const DreamService = require('../services/DreamService');
const MarketService = require('../services/MarketService');

const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT d.*,
      EXISTS (
        SELECT 1 FROM resonances r
        WHERE r.dream_id = d.id AND r.user_id = ?
      ) AS resonated,
      EXISTS (
        SELECT 1 FROM purchases p
        WHERE p.dream_id = d.id AND p.buyer_id = ?
      ) AS owned,
      EXISTS (
        SELECT 1 FROM rentals rt
        WHERE rt.dream_id = d.id
          AND rt.renter_id = ?
          AND rt.expires_at > datetime('now')
      ) AS rented
    FROM dreams d
    ORDER BY d.created_at DESC, d.id DESC
  `).all(req.user.id, req.user.id, req.user.id);

  const dreams = rows.map((row) => ({
    ...new Dream(row).toJSON(),
    resonated: Boolean(row.resonated),
    owned: Boolean(row.owned),
    rented: Boolean(row.rented),
  }));

  res.json({ dreams });
});

router.post('/', async (req, res, next) => {
  try {
    const row = await DreamService.create(req.user, req.body);
    return res.status(201).json({ dream: new Dream(row).toJSON() });
  } catch (error) {
    return next(error);
  }
});

router.post('/ai', async (req, res, next) => {
  try {
    const row = await DreamService.createAIDream();
    return res.status(201).json({ dream: new Dream(row).toJSON() });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/resonate', (req, res, next) => {
  try {
    return res.json(MarketService.resonate(req.user.id, Number(req.params.id)));
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/buy', (req, res, next) => {
  try {
    return res.json(MarketService.buy(req.user.id, Number(req.params.id)));
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/rent', (req, res, next) => {
  try {
    return res.json(MarketService.rent(req.user.id, Number(req.params.id)));
  } catch (error) {
    return next(error);
  }
});

router.get('/mine', (req, res) => {
  const rows = db.prepare(`
    SELECT d.*,
      EXISTS (
        SELECT 1 FROM purchases p
        WHERE p.dream_id = d.id AND p.buyer_id = ?
      ) AS owned,
      EXISTS (
        SELECT 1 FROM rentals rt
        WHERE rt.dream_id = d.id
          AND rt.renter_id = ?
          AND rt.expires_at > datetime('now')
      ) AS rented
    FROM dreams d
    WHERE d.author_id = ?
      OR d.id IN (SELECT dream_id FROM purchases WHERE buyer_id = ?)
      OR d.id IN (
        SELECT dream_id FROM rentals
        WHERE renter_id = ? AND expires_at > datetime('now')
      )
    ORDER BY d.created_at DESC
  `).all(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);

  const dreams = rows.map((row) => ({
    ...new Dream(row).toJSON(),
    owned: Boolean(row.owned),
    rented: Boolean(row.rented),
  }));

  res.json({ dreams });
});

router.get('/transactions', (req, res) => {
  const transactions = db.prepare(`
    SELECT t.*, d.title AS dream_title
    FROM transactions t
    LEFT JOIN dreams d ON d.id = t.dream_id
    WHERE t.user_id = ?
    ORDER BY t.created_at DESC
    LIMIT 100
  `).all(req.user.id);

  res.json({ transactions });
});

module.exports = router;
