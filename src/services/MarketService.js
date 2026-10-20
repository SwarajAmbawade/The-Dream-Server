const db = require('../db/database');
const Dream = require('../models/Dream');
const Transaction = require('../models/Transaction');

class MarketService {
  static listDreams() {
    const userId = db.__userId || -1;
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
    `).all(userId, userId, userId);

    return rows.map((row) => ({
      ...new Dream(row).toJSON(),
      resonated: Boolean(row.resonated),
      owned: Boolean(row.owned),
      rented: Boolean(row.rented),
    }));
  }

  static buy(userId, dreamId) {
    const purchase = db.transaction(() => {
      const dream = db.prepare('SELECT * FROM dreams WHERE id = ?').get(dreamId);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

      if (!dream) {
        throw Object.assign(new Error('Dream not found.'), { status: 404 });
      }
      if (!dream.for_sale) {
        throw Object.assign(new Error('This dream is not listed for sale.'), { status: 400 });
      }
      if (dream.author_id === userId) {
        throw Object.assign(new Error('You cannot buy your own dream.'), { status: 400 });
      }

      const existingPurchase = db.prepare(
        'SELECT id FROM purchases WHERE buyer_id = ? AND dream_id = ?',
      ).get(userId, dreamId);

      if (existingPurchase) {
        throw Object.assign(new Error('You already own this dream.'), { status: 409 });
      }
      if (!user || user.credits < dream.price) {
        throw Object.assign(new Error('Not enough credits.'), { status: 400 });
      }

      db.prepare(
        'UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?',
      ).run(dream.price, userId, dream.price);
      db.prepare(
        'INSERT INTO purchases (buyer_id, dream_id, price) VALUES (?, ?, ?)',
      ).run(userId, dreamId, dream.price);

      const transaction = new Transaction({
        userId,
        dreamId,
        type: 'purchase',
        amount: -dream.price,
      });
      transaction.validate();
      db.prepare(
        'INSERT INTO transactions (user_id, dream_id, type, amount) VALUES (?, ?, ?, ?)',
      ).run(transaction.userId, transaction.dreamId, transaction.type, transaction.amount);

      const updatedUser = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId);
      return { message: 'Dream purchased.', credits: updatedUser.credits };
    });

    return purchase();
  }

  static rent(userId, dreamId) {
    const rental = db.transaction(() => {
      const dream = db.prepare('SELECT * FROM dreams WHERE id = ?').get(dreamId);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

      if (!dream) {
        throw Object.assign(new Error('Dream not found.'), { status: 404 });
      }
      if (!dream.for_sale) {
        throw Object.assign(new Error('This dream is not listed for rent.'), { status: 400 });
      }
      if (dream.author_id === userId) {
        throw Object.assign(new Error('You cannot rent your own dream.'), { status: 400 });
      }

      const ownedDream = db.prepare(
        'SELECT id FROM purchases WHERE buyer_id = ? AND dream_id = ?',
      ).get(userId, dreamId);
      if (ownedDream) {
        throw Object.assign(new Error('You already own this dream.'), { status: 400 });
      }

      const activeRental = db.prepare(`
        SELECT id FROM rentals
        WHERE renter_id = ? AND dream_id = ? AND expires_at > datetime('now')
      `).get(userId, dreamId);
      if (activeRental) {
        throw Object.assign(new Error('Your rental is still active.'), { status: 409 });
      }
      if (!user || user.credits < dream.rent_price) {
        throw Object.assign(new Error('Not enough credits.'), { status: 400 });
      }

      db.prepare(
        'UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?',
      ).run(dream.rent_price, userId, dream.rent_price);
      db.prepare(`
        INSERT INTO rentals (renter_id, dream_id, price, expires_at)
        VALUES (?, ?, ?, datetime('now', '+7 days'))
      `).run(userId, dreamId, dream.rent_price);

      const transaction = new Transaction({
        userId,
        dreamId,
        type: 'rental',
        amount: -dream.rent_price,
      });
      transaction.validate();
      db.prepare(
        'INSERT INTO transactions (user_id, dream_id, type, amount) VALUES (?, ?, ?, ?)',
      ).run(transaction.userId, transaction.dreamId, transaction.type, transaction.amount);

      const updatedUser = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId);
      return {
        message: 'Dream rented for seven days.',
        credits: updatedUser.credits,
      };
    });

    return rental();
  }

  static resonate(userId, dreamId) {
    const toggleResonance = db.transaction(() => {
      const dream = db.prepare('SELECT id FROM dreams WHERE id = ?').get(dreamId);
      if (!dream) {
        throw Object.assign(new Error('Dream not found.'), { status: 404 });
      }

      const existing = db.prepare(
        'SELECT 1 FROM resonances WHERE user_id = ? AND dream_id = ?',
      ).get(userId, dreamId);

      if (existing) {
        db.prepare(
          'DELETE FROM resonances WHERE user_id = ? AND dream_id = ?',
        ).run(userId, dreamId);
        db.prepare('UPDATE dreams SET likes = MAX(0, likes - 1) WHERE id = ?').run(dreamId);
        return { resonated: false };
      }

      db.prepare(
        'INSERT INTO resonances (user_id, dream_id) VALUES (?, ?)',
      ).run(userId, dreamId);
      db.prepare('UPDATE dreams SET likes = likes + 1 WHERE id = ?').run(dreamId);
      return { resonated: true };
    });

    return toggleResonance();
  }
}

module.exports = MarketService;
