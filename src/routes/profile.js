const express = require('express');
const db = require('../db/database');
const router = express.Router();
const PACKS = new Set([250, 500, 1000, 2000]);

function utcDate() { return new Date().toISOString().slice(0, 10); }
function statusFor(userId) {
  const today = utcDate();
  const spin = db.prepare('SELECT reward, created_at FROM daily_spins WHERE user_id = ? AND spin_date = ?').get(userId, today);
  const events = db.prepare('SELECT id, event_type, amount, details, created_at FROM credit_events WHERE user_id = ? ORDER BY id DESC LIMIT 12').all(userId);
  return { spunToday: Boolean(spin), todayReward: spin?.reward ?? null, events };
}

router.get('/status', (req, res) => res.json(statusFor(req.user.id)));

// Deliberately simulated checkout. This does not accept or process real payment data.
router.post('/demo-topup', (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    if (!PACKS.has(amount) || amount > 2000) {
      throw Object.assign(new Error('Choose a demo pack of 250, 500, 1,000, or 2,000 credits. Maximum per checkout is 2,000.'), { status: 400 });
    }
    const result = db.transaction(() => {
      db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(amount, req.user.id);
      db.prepare("INSERT INTO credit_events (user_id, event_type, amount, details) VALUES (?, 'demo_topup', ?, ?)").run(req.user.id, amount, `Dream Tokens demo checkout · ${amount} credits`);
      return db.prepare('SELECT id, username, credits, created_at FROM users WHERE id = ?').get(req.user.id);
    })();
    res.json({ user: result, message: `Demo checkout complete: ${amount} credits added. No real money was charged.`, ...statusFor(req.user.id) });
  } catch (error) { next(error); }
});

router.post('/spin', (req, res, next) => {
  try {
    const today = utcDate();
    // Intentionally weighted: 45% zero, 30% five, 15% ten, 7% twenty-five, 2% fifty, 1% one hundred.
    const roll = Math.random() * 100;
    const reward = roll < 45 ? 0 : roll < 75 ? 5 : roll < 90 ? 10 : roll < 97 ? 25 : roll < 99 ? 50 : 100;
    const result = db.transaction(() => {
      try {
        db.prepare('INSERT INTO daily_spins (user_id, spin_date, reward) VALUES (?, ?, ?)').run(req.user.id, today, reward);
      } catch (e) {
        if (String(e.message).includes('UNIQUE')) throw Object.assign(new Error('You have already used today’s spin. Come back tomorrow.'), { status: 409 });
        throw e;
      }
      if (reward > 0) db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(reward, req.user.id);
      db.prepare("INSERT INTO credit_events (user_id, event_type, amount, details) VALUES (?, 'daily_spin', ?, ?)").run(req.user.id, reward, `Daily lucky wheel · ${reward} credits`);
      return db.prepare('SELECT id, username, credits, created_at FROM users WHERE id = ?').get(req.user.id);
    })();
    res.json({ user: result, reward, message: reward ? `The wheel landed on ${reward} credits!` : 'No credits this time. The wheel resets tomorrow.', ...statusFor(req.user.id) });
  } catch (error) { next(error); }
});

module.exports = router;
