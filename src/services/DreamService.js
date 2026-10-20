const db = require('../db/database');
const Listing = require('../models/Listing');
const AIDreamGenerator = require('./AIDreamGenerator');
const ImageService = require('./ImageService');

const VALID_MOODS = new Set(['Lucid', 'Peaceful', 'Surreal', 'Recurring', 'Nightmare']);

class DreamService {
  static async create(user, input) {
    const title = String(input.title || '').trim();
    const story = String(input.story || '').trim();
    const mood = String(input.mood || 'Surreal');

    if (title.length < 3 || title.length > 80) {
      throw Object.assign(new Error('Title must be 3–80 characters.'), { status: 400 });
    }

    if (story.length < 10 || story.length > 3000) {
      throw Object.assign(new Error('Dream story must be 10–3000 characters.'), { status: 400 });
    }

    if (!VALID_MOODS.has(mood)) {
      throw Object.assign(new Error('Choose a valid mood.'), { status: 400 });
    }

    const forSale = Boolean(input.forSale);
    const price = Number(input.price ?? 50);
    const rentPrice = Number(input.rent ?? 10);
    const listing = new Listing({
      dreamId: 0,
      sellerId: user.id,
      salePrice: price,
      rentPrice,
    });

    try {
      listing.validate();
    } catch (error) {
      throw Object.assign(error, { status: 400 });
    }

    if (price > 100000 || rentPrice > 100000) {
      throw Object.assign(new Error('Prices cannot exceed 100,000 credits.'), { status: 400 });
    }

    // Gallery search may take up to 12 seconds; local artwork remains the fallback.
    const artwork = await ImageService.generate(title, story, mood);
    const result = db.prepare(`
      INSERT INTO dreams (
        title, story, mood, author_id, author_name, for_sale, price, rent_price, image_url,
        image_credit, image_license, image_source_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      story,
      mood,
      user.id,
      user.username,
      forSale ? 1 : 0,
      forSale ? price : 0,
      forSale ? rentPrice : 0,
      artwork.url,
      artwork.credit,
      artwork.license,
      artwork.sourceUrl,
    );

    return db.prepare('SELECT * FROM dreams WHERE id = ?').get(result.lastInsertRowid);
  }

  static async createAIDream() {
    const dream = AIDreamGenerator.generate();
    const artwork = await ImageService.generate(dream.title, dream.story, dream.mood);
    const result = db.prepare(`
      INSERT INTO dreams (
        title, story, mood, author_id, author_name, likes,
        for_sale, price, rent_price, ai_origin, image_url, image_credit, image_license, image_source_url
      ) VALUES (?, ?, ?, NULL, 'Unknown', 0, 1, 100, 18, 1, ?, ?, ?, ?)
    `).run(dream.title, dream.story, dream.mood, artwork.url, artwork.credit, artwork.license, artwork.sourceUrl);

    return db.prepare('SELECT * FROM dreams WHERE id = ?').get(result.lastInsertRowid);
  }
}

module.exports = DreamService;
