require('dotenv').config();

const express = require('express');
const path = require('node:path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const db = require('./src/db/database');
const AuthService = require('./src/services/AuthService');
const ImageService = require('./src/services/ImageService');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error(
    'ERROR: Set JWT_SECRET to a random string of at least 32 characters in .env',
  );
  process.exit(1);
}

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
    },
  },
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api', (req, res, next) => {
  const publicRoutes = ['/health', '/auth/login', '/auth/register'];
  if (publicRoutes.includes(req.path)) {
    return next();
  }

  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : '';
  const user = AuthService.authenticate(token);

  if (!user) {
    return res.status(401).json({ error: 'Please log in to continue.' });
  }

  req.user = user;
  return next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'The Dream Server' });
});
app.use('/api', require('./src/routes'));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({
    error: error.status
      ? error.message
      : 'Something went wrong. Check the server console.',
  });
});

function seedStarterDreams() {
  const existingDreams = db.prepare('SELECT COUNT(*) AS count FROM dreams').get();
  if (existingDreams.count > 0) {
    return;
  }

  const starterDreams = [
    ['The city beneath the ocean','Reveal a breathtaking ancient-futuristic city resting on the ocean floor beneath a vast transparent dome. Elegant towers glow with soft turquoise and amber lights, connected by curved glass bridges. Bioluminescent marine life swims slowly between buildings, schools of tiny fish shimmer in the foreground, and enormous sea creatures pass as distant silhouettes. Sunbeams filter through deep blue water and illuminate the citys domes and surrounding coral formations.','Surreal', 'Unknown', 65, 1, 200, 35, 0],
    ['The door at the end of the sea','Deep beneath the ocean, an ancient ornate doorway stands at the edge of a submerged stone platform. Beyond it, an impossible underwater city glows with tiny lights, surrounded by immense transparent jellyfish drifting through dark turquoise water. Soft blue rays descend from the unseen surface, illuminating floating particles and the doorways intricate stone carvings.','Surreal', 'Unknown', 81, 1, 200, 35, 0],
    ['Flying over a glass city', 'I floated above a city of glass towers while the sun set inside them.', 'Lucid', 'Aarav', 42, 1, 120, 20, 0],
    ['The endless staircase', 'I climbed a staircase that kept rebuilding itself under a full moon.', 'Recurring', 'Meera', 37, 1, 90, 15, 0],
    ['Tea in a lavender garden', 'My grandfather and I sat in a garden of trees and he named a star I had never heard of.', 'Peaceful', 'Rohan', 55, 1, 150, 25, 0],
    ['Underwater library', 'Books drifted like jellyfish in the deep sea. Reading one let me breathe water.', 'Surreal', 'Isha', 29, 1, 80, 12, 0],
    ['Chased by a clock', 'A giant clock rolled after me and every tick took a year of time away.', 'Nightmare', 'Kabir', 18, 0, 0, 0, 0],
    ['The door nobody opened', 'A glowing door in a field at night. No one remembers dreaming it.', 'Surreal', 'Unknown', 61, 1, 200, 35, 0],
    ['A train that stops in a memory', 'A night train glided over the sea and stopped inside a city I forgot.', 'Lucid', 'Unknown', 48, 1, 170, 30, 0],
    ['The Library of Fallen Leaves', 'A massive ancient cathedral library stands beneath a twilight sky visible through a ceiling that has opened into the heavens.', 'Lucid', 'kiara', 70, 1, 150, 30, 0],
    ['the static sump', 'A damp, suffocating concrete stairwell spirals downward into darkness, repeating endlessly like a forgotten underground building.', 'Lucid', 'Unknown', 50, 1, 170, 30, 0],
  ];

  const insertDream = db.prepare(`
    INSERT INTO dreams (
      title, story, mood, author_id, author_name, likes, for_sale,
      price, rent_price, ai_origin, image_url
    ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction(() => {
    for (const dream of starterDreams) {
      const [
        title, story, mood, author, likes,
        forSale, price, rentPrice, aiOrigin
      ] = dream;

      // Skip starter dreams that already exist
      const existing = db.prepare(
        'SELECT id FROM dreams WHERE title = ? LIMIT 1'
      ).get(title);

      if (existing) continue;

      const image = ImageService.procedural(title, story, mood);

      insertDream.run(
        title, story, mood, author, likes,
        forSale, price, rentPrice, aiOrigin, image
      );
    }
  });

  insertAll();
}

seedStarterDreams();
app.listen(PORT, () => {
  console.log(`The Dream Server is running at http://localhost:${PORT}`);
});
