const { resolveDefaultImage } = require('../services/DefaultDreamMedia');

class Dream {
  constructor(row) {
    this.id = row.id;
    this.title = row.title;
    this.story = row.story;
    this.mood = row.mood;
    this.authorId = row.author_id;
    this.author = row.author_name;
    this.likes = row.likes;
    this.forSale = Boolean(row.for_sale);
    this.price = row.price;
    this.rent = row.rent_price;
    this.ai = Boolean(row.ai_origin);
    // Starter dreams can have ai_origin=1 while still being built-in seed records.
    // A curated local mapping is the reliable signal; generated/user dreams without a mapping keep their stored URL.
    const isBuiltIn = row.author_id == null;
    this.imageUrl = (isBuiltIn && resolveDefaultImage(row.title)) || row.image_url;
    this.imageCredit = row.image_credit || null;
    this.imageLicense = row.image_license || null;
    this.imageSourceUrl = row.image_source_url || null;
    this.createdAt = row.created_at;
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      story: this.story,
      mood: this.mood,
      authorId: this.authorId,
      author: this.author,
      likes: this.likes,
      forSale: this.forSale,
      price: this.price,
      rent: this.rent,
      ai: this.ai,
      imageUrl: this.imageUrl,
      imageCredit: this.imageCredit,
      imageLicense: this.imageLicense,
      imageSourceUrl: this.imageSourceUrl,
      createdAt: this.createdAt,
    };
  }
}

module.exports = Dream;
