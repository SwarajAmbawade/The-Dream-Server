const assert = require('node:assert/strict');
const test = require('node:test');

const Listing = require('../src/models/Listing');
const Transaction = require('../src/models/Transaction');
const AIDreamGenerator = require('../src/services/AIDreamGenerator');
const ImageService = require('../src/services/ImageService');
const DefaultDreamMedia = require('../src/services/DefaultDreamMedia');
const Dream = require('../src/models/Dream');
const fs = require('node:fs');
const path = require('node:path');

test('Listing accepts whole non-negative credit prices', () => {
  const listing = new Listing({
    dreamId: 1,
    sellerId: 2,
    salePrice: 50,
    rentPrice: 10,
  });

  assert.doesNotThrow(() => listing.validate());
});

test('Listing rejects negative and fractional prices', () => {
  const negativePrice = new Listing({
    dreamId: 1,
    sellerId: 2,
    salePrice: -1,
    rentPrice: 10,
  });
  const fractionalPrice = new Listing({
    dreamId: 1,
    sellerId: 2,
    salePrice: 1.5,
    rentPrice: 10,
  });

  assert.throws(() => negativePrice.validate());
  assert.throws(() => fractionalPrice.validate());
});

test('Transaction only accepts supported types and integer amounts', () => {
  const validTransaction = new Transaction({
    userId: 1,
    dreamId: 2,
    type: 'purchase',
    amount: -50,
  });
  const invalidType = new Transaction({
    userId: 1,
    dreamId: 2,
    type: 'magic',
    amount: -50,
  });
  const fractionalAmount = new Transaction({
    userId: 1,
    dreamId: 2,
    type: 'rental',
    amount: -1.5,
  });

  assert.doesNotThrow(() => validTransaction.validate());
  assert.throws(() => invalidType.validate());
  assert.throws(() => fractionalAmount.validate());
});

test('Unclaimed dream generator returns a valid unknown-origin dream', () => {
  const dream = AIDreamGenerator.generate();

  assert.ok(dream.title.length > 0);
  assert.ok(dream.story.length > 0);
  assert.equal(dream.author, 'Unknown');
  assert.equal(dream.ai, true);
});

test('Procedural renderer returns an SVG data URI with scene-specific details', () => {
  const image = ImageService.procedural(
    'A door by the sea',
    'I opened a glowing door under the ocean',
    'Surreal',
  );
  const decodedSvg = Buffer.from(image.split(',')[1], 'base64').toString('utf8');

  assert.match(image, /^data:image\/svg\+xml;base64,/);
  assert.match(decodedSvg, /<svg/);
  assert.match(decodedSvg, /A DREAM, REMEMBERED/);
  assert.match(decodedSvg, /<path/);
});

test('Gallery query includes scene keywords and mood styling', () => {
  const query = ImageService.buildSearchQuery(
    'The train over the ocean',
    'I saw a train crossing a dark ocean at night',
    'Nightmare',
  );

  assert.match(query, /train|ocean/i);
  assert.match(query, /dark|eerie|cinematic/i);
});

test('Gallery result selection chooses relevant licensed artwork', () => {
  const images = [
    { title: 'Bright flowers in a garden', license: 'by', url: 'https://images.example/flowers.jpg' },
    { title: 'A train crossing a moonlit ocean', license: 'by-sa', url: 'https://images.example/train.jpg', creator: 'Artist B' },
  ];
  const selected = ImageService.selectImage(
    images,
    'A train over the ocean',
    'A train crossed the ocean',
    'Surreal',
  );

  assert.equal(selected.url, 'https://images.example/train.jpg');
});


test('Pixabay search uses concise scene-specific terms instead of the full story', () => {
  const query = ImageService.buildSearchQuery(
    'The City Beneath the Ocean',
    'I discovered an abandoned city beneath a deep blue ocean. Ancient towers rose through the mist while a giant golden moon illuminated the water.',
    'Surreal',
  );
  assert.match(query, /underwater|ocean|sea/i);
  assert.match(query, /city|tower|architecture/i);
  assert.ok(query.length <= 100);
});

test('Pixabay relevance scoring prefers underwater-city tags over unrelated sea-god tags', () => {
  const relevant = { id: 1, tags: 'underwater city ruins ocean ancient architecture moon', webformatURL: 'https://images.example/a.jpg', pageURL: 'https://pixabay.com/a' };
  const unrelated = { id: 2, tags: 'poseidon god statue waves mythology', webformatURL: 'https://images.example/b.jpg', pageURL: 'https://pixabay.com/b' };
  const title = 'The City Beneath the Ocean';
  const story = 'An abandoned city beneath a deep blue ocean, ancient towers and a golden moon.';
  assert.ok(ImageService.scorePixabayImage(relevant, title, story, 'Surreal') > ImageService.scorePixabayImage(unrelated, title, story, 'Surreal'));
  assert.equal(ImageService.selectPixabayImage([unrelated, relevant], title, story, 'Surreal'), relevant);
});


test('Default dream titles normalize punctuation and whitespace consistently', () => {
  assert.equal(
    DefaultDreamMedia.normalizeDreamTitle('  A Train That Stops in a Memory  '),
    DefaultDreamMedia.normalizeDreamTitle('a train   that stops in a memory'),
  );
  assert.equal(
    DefaultDreamMedia.normalizeDreamTitle('The Door Nobody Opened'),
    'the door nobody opened',
  );
});

test('Default dream media resolves only the explicitly mapped local asset and safely falls back when absent', () => {
  const assetsDir = path.join(__dirname, '..', 'public', 'assets');
  const imageDir = path.join(assetsDir, 'dreams');
  const videoDir = path.join(assetsDir, 'dream-videos');
  const imageFile = path.join(imageDir, 'the-door-nobody-opened.jpg');
  const videoFile = path.join(videoDir, 'the-door-nobody-opened.mp4');
  const hadImage = fs.existsSync(imageFile);
  const hadVideo = fs.existsSync(videoFile);
  fs.mkdirSync(imageDir, { recursive: true });
  fs.mkdirSync(videoDir, { recursive: true });
  try {
    if (!hadImage) fs.writeFileSync(imageFile, 'test-image-placeholder');
    if (!hadVideo) fs.writeFileSync(videoFile, 'test-video-placeholder');
    assert.equal(
      DefaultDreamMedia.resolveDefaultImage('The door nobody opened'),
      '/assets/dreams/the-door-nobody-opened.jpg',
    );
    assert.equal(
      DefaultDreamMedia.resolveDefaultVideo('THE DOOR NOBODY OPENED'),
      '/assets/dream-videos/the-door-nobody-opened.mp4',
    );
    assert.equal(
      DefaultDreamMedia.resolveDefaultImage('A user-created dream'),
      null,
    );
  } finally {
    if (!hadImage) fs.rmSync(imageFile, { force: true });
    if (!hadVideo) fs.rmSync(videoFile, { force: true });
  }
});


test('AI-origin starter records still receive mapped artwork when they are built-in records', () => {
  const imageFile = path.join(__dirname, '..', 'public', 'assets', 'dreams', 'the-door-nobody-opened.jpg');
  const hadImage = fs.existsSync(imageFile);
  fs.mkdirSync(path.dirname(imageFile), { recursive: true });
  try {
    if (!hadImage) fs.writeFileSync(imageFile, 'test-image-placeholder');
    const dream = new Dream({
      id: 6,
      title: 'The door nobody opened',
      story: 'A glowing door in a field at night.',
      mood: 'Surreal',
      author_id: null,
      author_name: 'Unknown',
      likes: 61,
      for_sale: 1,
      price: 200,
      rent_price: 35,
      ai_origin: 1,
      image_url: 'data:image/svg+xml;base64,stored-fallback',
    });
    assert.equal(dream.toJSON().imageUrl, '/assets/dreams/the-door-nobody-opened.jpg');
  } finally {
    if (!hadImage) fs.rmSync(imageFile, { force: true });
  }
});
