const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const PIXABAY_SEARCH_URL = 'https://pixabay.com/api/';
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const IMAGE_DIR = path.join(PROJECT_ROOT, 'public', 'generated-images');
const CACHE_DIR = path.join(PROJECT_ROOT, 'data', 'pixabay-cache');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;
// Deliberately stay far below Pixabay's documented 100 requests / 60 seconds.
const LOCAL_RATE_WINDOW_MS = 60 * 1000;
const LOCAL_MAX_REQUESTS_PER_WINDOW = 8;
let requestWindowStartedAt = Date.now();
let requestsInWindow = 0;
let apiCooldownUntil = 0;
const STOP_WORDS = new Set([
  'about', 'after', 'again', 'around', 'because', 'before', 'being', 'could',
  'dream', 'dreamed', 'dreaming', 'from', 'have', 'into', 'just', 'like',
  'made', 'more', 'over', 'that', 'them', 'there', 'they', 'this', 'through',
  'under', 'very', 'were', 'when', 'where', 'which', 'while', 'with', 'would',
]);

/**
 * Creates dream artwork without requiring a paid image-generation model.
 * Pixabay search is an optional API enhancement; procedural artwork is always available.
 */
class ImageService {
  /**
   * Find a suitable existing image, falling back to locally generated SVG art.
   * @param {string} title Dream title.
   * @param {string} story Dream description.
   * @param {string} mood Dream mood.
   * @returns {Promise<string>} A remote image URL or an SVG data URI.
   */
  static async generate(title, story, mood) {
    const localImage = await ImageService.findCuratedAsset(title, story, mood);
    if (localImage) return localImage;

    // Middle layer: automatically match the dream against artwork already in
    // public/assets/dreams before making any network request.
    const galleryAsset = await ImageService.findLocalGalleryAsset(title, story, mood);
    if (galleryAsset) return galleryAsset;

    const curatedImage = await ImageService.findGalleryImage(title, story, mood);
    if (curatedImage) return curatedImage;

    return { url: ImageService.procedural(title, story, mood), credit: null, license: 'Locally generated SVG artwork', sourceUrl: null };
  }

  /**
   * Optional curated image overrides. Put hand-picked/AI-generated files in
   * public/assets/dreams and map exact dream titles in assets/dream-images.json.
   * Local assets never consume API calls.
   */
  static async findCuratedAsset(title) {
    const mapPath = path.join(PROJECT_ROOT, 'public', 'assets', 'dream-images.json');
    try {
      const mapping = JSON.parse(await fs.readFile(mapPath, 'utf8'));
      const filename = mapping[String(title || '').trim().toLowerCase()];
      if (!filename || path.basename(filename) !== filename || !/^[\w.-]+\.(png|jpe?g|webp)$/i.test(filename)) return null;
      const assetPath = path.join(PROJECT_ROOT, 'public', 'assets', 'dreams', filename);
      await fs.access(assetPath);
      return { url: `/assets/dreams/${filename}`, credit: 'Original artwork', license: 'Project-owned artwork', sourceUrl: null };
    } catch {
      return null;
    }
  }

  /**
   * Match a dream to existing local artwork by filename. This makes the curated
   * gallery useful without requiring an exact-title JSON mapping and avoids
   * Pixabay requests for dreams that already have a relevant local image.
   */
  static async findLocalGalleryAsset(title, story, mood) {
    const directory = path.join(PROJECT_ROOT, 'public', 'assets', 'dreams');
    const stopWords = new Set([
      ...STOP_WORDS, 'a', 'an', 'and', 'are', 'at', 'be', 'by', 'for', 'i',
      'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'the', 'to', 'was',
      'we', 'you', 'your', 'playing', 'play', 'watching', 'watched', 'got',
      'had', 'saw', 'see', 'seeing', 'went', 'walking', 'swimming', 'infinite',
      'endless', 'recurring', 'surreal', 'lucid', 'peaceful', 'nightmare',
    ]);
    const aliases = {
      desert: ['dessert', 'sand', 'dunes'], dessert: ['desert', 'sand', 'dunes'],
      door: ['doors', 'portal', 'portals'], doors: ['door', 'portal', 'portals'],
      scary: ['horror', 'nightmare', 'dark', 'shadow'], horror: ['scary', 'nightmare'],
      lady: ['woman', 'girl', 'person'], woman: ['lady', 'girl'],
      road: ['street', 'highway'], street: ['road', 'highway'],
      dog: ['puppy', 'pet'], puppy: ['dog', 'pet'], garden: ['flowers', 'blossom', 'lavender'],
      staircase: ['stairs', 'steps'], stairs: ['staircase', 'steps'],
      ocean: ['sea', 'underwater', 'water'], water: ['ocean', 'underwater', 'sea'],
      city: ['cityscape', 'buildings', 'urban'],
    };
    const tokenize = (value) => String(value || '').toLowerCase()
      .normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/)
      .filter((word) => word && !stopWords.has(word));

    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      const files = entries.filter((entry) => entry.isFile() && /\.(?:png|jpe?g|webp)$/i.test(entry.name));
      const dreamWords = new Set(tokenize(`${title || ''} ${story || ''} ${mood || ''}`));
      const expandedWords = new Set(dreamWords);
      for (const word of dreamWords) for (const alias of aliases[word] || []) expandedWords.add(alias);
      if (!expandedWords.size) return null;

      let best = null;
      for (const entry of files) {
        const stemWords = new Set(tokenize(path.basename(entry.name, path.extname(entry.name))));
        let score = 0;
        for (const word of stemWords) {
          if (dreamWords.has(word)) score += 3;
          else if (expandedWords.has(word)) score += 1;
        }
        // A local image should be a meaningful match, not merely share a generic word.
        if (!best || score > best.score) best = { filename: entry.name, score };
      }
      if (!best || best.score < 3) return null;
      console.log(`[images] Using local gallery artwork "${best.filename}" (match score ${best.score})`);
      return {
        url: `/assets/dreams/${encodeURIComponent(best.filename)}`,
        credit: 'Original artwork', license: 'Project-owned artwork', sourceUrl: null,
      };
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn(`[images] Local gallery lookup failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Pixabay search is deliberately limited to one concise request per new dream.
   * Every result (including empty results) is cached for 24 hours. A local token
   * bucket and cooldown protect the API key; 429s never trigger automatic retries.
   */
  static async findGalleryImage(title, story, mood) {
    const apiKey = process.env.PIXABAY_API_KEY;
    if (!apiKey) return null;

    const query = ImageService.buildSearchQuery(title, story, mood);
    if (!query) return null;
    const cacheKey = crypto.createHash('sha256').update(query.toLowerCase()).digest('hex');
    const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
    let hit = null;
    let cached = false;

    try {
      const saved = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
      if (saved.savedAt && Date.now() - saved.savedAt < CACHE_TTL_MS) {
        hit = saved.hit || null;
        cached = true;
      }
    } catch { /* cache miss */ }

    if (!cached) {
      const now = Date.now();
      if (now < apiCooldownUntil) {
        console.warn(`[images] Pixabay cooldown active for ${Math.ceil((apiCooldownUntil - now) / 1000)}s; using local artwork.`);
        return null;
      }
      if (now - requestWindowStartedAt >= LOCAL_RATE_WINDOW_MS) {
        requestWindowStartedAt = now;
        requestsInWindow = 0;
      }
      if (requestsInWindow >= LOCAL_MAX_REQUESTS_PER_WINDOW) {
        console.warn('[images] Local Pixabay safety limit reached (8/min); using local artwork.');
        return null;
      }
      requestsInWindow += 1;

      try {
        const url = new URL(PIXABAY_SEARCH_URL);
        url.searchParams.set('key', apiKey);
        url.searchParams.set('q', query.slice(0, 100));
        url.searchParams.set('image_type', 'all');
        url.searchParams.set('lang', 'en');
        url.searchParams.set('orientation', 'horizontal');
        url.searchParams.set('safesearch', 'true');
        url.searchParams.set('per_page', '50');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        let response;
        try {
          response = await fetch(url, {
            headers: { Accept: 'application/json', 'User-Agent': 'TheDreamServer/1.5 (student OOMD project)' },
            signal: controller.signal,
          });
        } finally { clearTimeout(timeout); }

        if (response.status === 429) {
          const resetSeconds = Number(response.headers.get('X-RateLimit-Reset'));
          apiCooldownUntil = Date.now() + (Number.isFinite(resetSeconds) && resetSeconds > 0 ? resetSeconds * 1000 : 60_000);
          console.warn('[images] Pixabay returned HTTP 429; cooling down and using local artwork.');
          return null;
        }
        if (!response.ok) {
          const details = (await response.text()).slice(0, 180);
          throw new Error(`Pixabay returned HTTP ${response.status}${details ? `: ${details}` : ''}`);
        }
        const result = await response.json();
        hit = ImageService.selectPixabayImage(Array.isArray(result.hits) ? result.hits : [], title, story, mood);
        await fs.mkdir(CACHE_DIR, { recursive: true });
        await fs.writeFile(cacheFile, JSON.stringify({ savedAt: Date.now(), hit }), 'utf8');
      } catch (error) {
        const reason = error.name === 'AbortError' ? `request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds` : error.message;
        console.warn(`[images] Pixabay search failed for "${query}": ${reason}`);
        return null;
      }
    }

    if (!hit || !hit.webformatURL || !hit.pageURL) {
      console.warn(`[images] No relevant cached Pixabay result for "${query}"; using local artwork.`);
      return null;
    }

    // Reject semantically weak results rather than showing an unrelated image.
    const relevance = ImageService.scorePixabayImage(hit, title, story, mood);
    if (relevance < 1) {
      console.log(`[images] Best Pixabay match scored too low (${relevance}); using local artwork.`);
      return null;
    }

    const extension = /\.png(?:\?|$)/i.test(hit.webformatURL) ? 'png' : 'jpg';
    const imageName = `pixabay-${hit.id}-${cacheKey}.${extension}`;
    const imagePath = path.join(IMAGE_DIR, imageName);
    try {
      await fs.access(imagePath);
    } catch {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const imageResponse = await fetch(hit.webformatURL, { signal: controller.signal });
        if (!imageResponse.ok) throw new Error(`Image download returned HTTP ${imageResponse.status}`);
        const contentType = imageResponse.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) throw new Error('Pixabay URL did not return an image');
        const bytes = Buffer.from(await imageResponse.arrayBuffer());
        if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new Error('Image size is empty or exceeds 8 MB');
        await fs.mkdir(IMAGE_DIR, { recursive: true });
        await fs.writeFile(imagePath, bytes);
      } catch (error) {
        console.warn(`[images] Image download failed: ${error.message}; using local artwork.`);
        return null;
      } finally { clearTimeout(timeout); }
    }

    console.log(`[images] Pixabay match found for "${query}"${cached ? ' (cached)' : ''}`);
    return { url: `/generated-images/${imageName}`, credit: hit.user || 'Pixabay contributor', license: 'Pixabay Content License', sourceUrl: hit.pageURL };
  }

  static scorePixabayImage(image, title, story, mood) {
    const terms = ImageService.extractSceneTerms(title, story);
    const description = ` ${String(image.tags || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} ${String(image.type || '').toLowerCase()} `;
    let score = 0;
    for (const term of terms) {
      const normalized = term.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (normalized && description.includes(` ${normalized} `)) score += normalized.includes(' ') ? 4 : 3;
    }
    const moodWords = {
      Lucid: /surreal|dream|fantasy|sky|cloud|cinematic/,
      Peaceful: /peaceful|calm|mist|garden|soft|serene/,
      Surreal: /surreal|fantasy|dream|ethereal|impossible/,
      Recurring: /mysterious|fog|mist|dream|surreal/,
      Nightmare: /dark|night|shadow|storm|gothic|eerie|horror|scary/,
    };
    if (moodWords[mood]?.test(description)) score += 1;
    return score;
  }

  /** Convert dream language into concrete, Pixabay-friendly scene concepts. */
  static extractSceneTerms(title, story) {
    const text = `${title || ''} ${story || ''}`.toLowerCase().replace(/[’‘]/g, "'");
    const groups = [
      [/scary lady|scary woman|creepy woman|woman watching|lady watching|watching me|haunted woman|ghost woman/.test(text), ['woman', 'scary woman', 'horror', 'ghost', 'shadow', 'creepy']],
      [/\b(lady|woman|female|girl)\b/.test(text), ['woman', 'girl', 'portrait', 'silhouette']],
      [/\b(dessert|desert|dunes|sand|sahara)\b/.test(text), ['desert', 'sand dunes', 'dunes', 'sandstorm']],
      [/infinite doors|endless doors|doors in|many doors|door after door/.test(text), ['doors', 'door', 'corridor', 'infinite hallway', 'portal']],
      [/\bdoor|doors|portal|gate|entrance\b/.test(text), ['door', 'doors', 'portal', 'corridor', 'mysterious doorway']],
      [/swimming|underwater|flooded|water on the road|road.*water|street.*water/.test(text), ['flooded road', 'underwater street', 'flooded street', 'swimming', 'water', 'road']],
      [/\broad|street|highway|pavement\b/.test(text), ['road', 'empty road', 'street', 'highway']],
      [/\bdog|puppy|pet\b/.test(text), ['dog', 'puppy', 'dog in garden', 'pet']],
      [/\bgarden|graden|backyard|lawn|flowers|flowerbed\b/.test(text), ['garden', 'backyard', 'green garden', 'flowers', 'lawn']],
      [/\b(city|cities|tower|towers|building|buildings|skyscraper)\b/.test(text), ['cityscape', 'skyscraper', 'tower', 'architecture']],
      [/\bmoon|lunar|night sky\b/.test(text), ['moon', 'moonlight', 'night sky']],
      [/\bstair|stairs|steps|staircase\b/.test(text), ['staircase', 'stairs', 'steps']],
      [/\btrain|railway|station|subway\b/.test(text), ['train', 'railway', 'station']],
      [/\bforest|tree|woods\b/.test(text), ['forest', 'trees', 'woods']],
      [/\bbook|library\b/.test(text), ['library', 'books']],
      [/\bfly|flying|float|floating|sky|clouds\b/.test(text), ['floating', 'sky', 'clouds']],
      [/\bclock|chased|chase\b/.test(text), ['clock', 'dark', 'surreal']],
    ];
    const specific = groups.filter(([matches]) => matches).flatMap(([, terms]) => terms);
    if (specific.length) return [...new Set(specific)];
    const meaningful = text.split(/[^a-z0-9]+/).filter((word) => word.length > 3 && !STOP_WORDS.has(word));
    return [...new Set(meaningful)].slice(0, 5).concat(['surreal']);
  }

  /** One short, concrete query gives Pixabay more useful matches than a long synonym list. */
  static buildSearchQuery(title, story, mood) {
    const terms = ImageService.extractSceneTerms(title, story);
    const text = `${title || ''} ${story || ''}`.toLowerCase();
    let queryTerms;
    if (/scary lady|scary woman|creepy woman|woman watching|lady watching|watching me/.test(text)) queryTerms = ['scary woman', 'horror'];
    else if (/infinite doors|endless doors|doors in|many doors|door after door/.test(text) && /dessert|desert|dunes|sand/.test(text)) queryTerms = ['desert doors', 'sand dunes'];
    else if (/\b(dessert|desert|dunes|sand|sahara)\b/.test(text) && /\bdoor|doors|portal\b/.test(text)) queryTerms = ['desert door', 'sand dunes'];
    else if (/swimming|underwater|flooded|water on the road|road.*water|street.*water/.test(text) && /\broad|street|highway\b/.test(text)) queryTerms = ['flooded road', 'underwater street'];
    else if (/\bdog|puppy|pet\b/.test(text) && /\bgarden|graden|backyard|lawn\b/.test(text)) queryTerms = ['dog garden', 'dog outdoors'];
    else queryTerms = terms.slice(0, 2);
    // Avoid mood-only terms: they dilute the scene-specific query and reduce relevance.
    return [...new Set(queryTerms)].join(' ').slice(0, 90);
  }

  static buildBroadSearchQuery(title, story, mood) {
    return ImageService.buildSearchQuery(title, story, mood);
  }

  /** Rank Pixabay hits by scene-word overlap and use popularity only as a tie-breaker. */
  static selectPixabayImage(images, title, story, mood) {
    return images
      .filter((image) => image && image.id && image.webformatURL && image.pageURL)
      .map((image) => ({ image, score: ImageService.scorePixabayImage(image, title, story, mood) }))
      .sort((a, b) => b.score - a.score || (Number(b.image.likes) || 0) - (Number(a.image.likes) || 0))[0]?.image || null;
  }

  /**
   * Rank gallery results by scene-word overlap and prefer usable image URLs.
   * Openverse supplies creator and license metadata, which is saved for attribution.
   */
  static selectImage(images, title, story, mood) {
    const words = `${title} ${story}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3 && !STOP_WORDS.has(word));

    return images
      .filter((image) => image && (image.thumbnail || image.url) && image.license)
      .map((image) => {
        const description = `${image.title || ''} ${image.tags?.map((tag) => tag.name || '').join(' ') || ''}`.toLowerCase();
        const matches = words.reduce(
          (score, word) => score + (description.includes(word) ? 2 : 0),
          0,
        );
        const moodBonus = mood === 'Nightmare' && /dark|night|shadow|storm|gothic/.test(description)
          ? 1
          : 0;
        const safeLicenseBonus = /by|cc0|zero/.test(image.license) ? 1 : 0;

        return { image, score: matches + moodBonus + safeLicenseBonus };
      })
      .sort((first, second) => second.score - first.score)[0]?.image || null;
  }

  /**
   * Generate layered, seeded SVG artwork locally. The scene is deterministic
   * for a given dream, so refreshes do not unexpectedly change the artwork.
   */
  static procedural(title, story, mood) {
    const source = `${title} ${story} ${mood}`;
    const seed = crypto.createHash('sha256').update(source).digest('hex');
    const scene = source.toLowerCase();
    const isNight = mood === 'Nightmare' || /night|moon|dark|shadow|midnight/.test(scene);
    const palette = ImageService.getPalette(mood, isNight);
    const random = ImageService.createSeededRandom(seed);
    const escapeXml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;',
    })[character]);

    const stars = Array.from({ length: 72 }, () => {
      const x = Math.round(random() * 1200);
      const y = Math.round(random() * 440);
      const radius = (random() * 1.8 + 0.4).toFixed(1);
      const opacity = (random() * 0.55 + 0.15).toFixed(2);
      return `<circle cx="${x}" cy="${y}" r="${radius}" fill="#f1f0df" opacity="${opacity}"/>`;
    }).join('');

    const distantMountains = `
      <path d="M0 430 L145 275 245 390 390 235 545 410 690 285 830 405 1000 255 1200 420 V760 H0Z" fill="${palette.mountain}" opacity=".64"/>
      <path d="M0 500 L170 370 300 470 475 335 640 490 820 360 990 485 1110 390 1200 455 V760 H0Z" fill="${palette.hill}" opacity=".78"/>
      <path d="M0 570 Q180 500 360 565 T720 560 T1200 535 V760 H0Z" fill="${palette.foreground}"/>
    `;

    const moon = `
      <circle cx="900" cy="150" r="105" fill="${palette.glow}" opacity=".08"/>
      <circle cx="900" cy="150" r="73" fill="${palette.moon}" opacity=".94"/>
      <circle cx="878" cy="130" r="73" fill="${palette.background}" opacity=".08"/>
    `;

    const sceneDetails = ImageService.createSceneDetails(scene, palette, random);
    const mist = `
      <ellipse cx="210" cy="570" rx="340" ry="52" fill="${palette.mist}" opacity=".18"/>
      <ellipse cx="850" cy="625" rx="430" ry="66" fill="${palette.mist}" opacity=".12"/>
      <path d="M0 650 Q200 615 400 655 T800 650 T1200 635 V760 H0Z" fill="#080d0b" opacity=".18"/>
    `;

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0%" stop-color="${palette.background}"/>
            <stop offset="58%" stop-color="${palette.sky}"/>
            <stop offset="100%" stop-color="${palette.foreground}"/>
          </linearGradient>
          <radialGradient id="atmosphere" cx="74%" cy="20%" r="68%">
            <stop offset="0%" stop-color="${palette.glow}" stop-opacity=".26"/>
            <stop offset="100%" stop-color="${palette.glow}" stop-opacity="0"/>
          </radialGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop stop-color="${palette.hill}"/>
            <stop offset="100%" stop-color="#080d0b"/>
          </linearGradient>
          <filter id="blur"><feGaussianBlur stdDeviation="24"/></filter>
        </defs>
        <rect width="1200" height="760" fill="url(#sky)"/>
        <rect width="1200" height="760" fill="url(#atmosphere)"/>
        <ellipse cx="900" cy="180" rx="220" ry="170" fill="${palette.glow}" opacity=".10" filter="url(#blur)"/>
        ${stars}
        ${moon}
        ${distantMountains}
        ${sceneDetails}
        ${mist}
        <rect x="0" y="0" width="1200" height="760" fill="url(#ground)" opacity=".14"/>
        <rect x="0" y="0" width="1200" height="760" fill="#07100c" opacity=".12"/>
        <text x="48" y="700" fill="#f0eee2" font-family="Arial, sans-serif" font-size="25" letter-spacing="2" opacity=".82">${escapeXml(title.slice(0, 48))}</text>
        <text x="49" y="728" fill="#c0c9bf" font-family="Arial, sans-serif" font-size="11" letter-spacing="4" opacity=".64">A DREAM, REMEMBERED</text>
      </svg>
    `;

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  static getPalette(mood, isNight) {
    const palettes = {
      Lucid: ['#101b1b', '#263d38', '#536c5d', '#172923', '#d9c28c', '#c5d7c7'],
      Peaceful: ['#18211c', '#405c4b', '#708b70', '#263b2e', '#e4d6a7', '#d0dfd0'],
      Surreal: ['#151b1a', '#334a43', '#637e6b', '#1e302a', '#e0c38a', '#c9d8ca'],
      Recurring: ['#111817', '#2d4038', '#526b5b', '#182720', '#d4b778', '#c1d0c2'],
      Nightmare: ['#090e10', '#182725', '#344b43', '#101b19', '#bca875', '#8fa49a'],
    };
    const [background, sky, mountain, foreground, moon, mist] = palettes[mood] || palettes.Surreal;

    return {
      background: isNight ? '#090e10' : background,
      sky: isNight ? '#1a2925' : sky,
      mountain,
      hill: foreground,
      foreground,
      moon,
      glow: moon,
      mist,
    };
  }

  static createSeededRandom(seed) {
    let state = Number.parseInt(seed.slice(0, 8), 16) || 1;

    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  static createSceneDetails(scene, palette, random) {
    const details = [];

    if (/sea|ocean|water|rain|river|underwater|lake/.test(scene)) {
      details.push(`
        <path d="M0 525 Q130 500 260 530 T520 525 T780 530 T1040 520 T1200 530 V760 H0Z" fill="#1b3a36" opacity=".86"/>
        <path d="M0 570 Q160 550 320 572 T640 570 T960 568 T1200 570" stroke="${palette.mist}" stroke-width="3" opacity=".34" fill="none"/>
        <path d="M0 620 Q150 600 300 622 T600 620 T900 620 T1200 615" stroke="${palette.mist}" stroke-width="2" opacity=".24" fill="none"/>
      `);
    }

    if (/train|rail|station|subway/.test(scene)) {
      details.push(`
        <path d="M0 690 L430 560 M1200 690 L770 560" stroke="#b8b9a4" stroke-width="4" opacity=".45"/>
        <path d="M0 720 L430 580 M1200 720 L770 580" stroke="#b8b9a4" stroke-width="2" opacity=".3"/>
        <g transform="translate(400 420)">
          <path d="M0 40 Q0 0 42 0 H300 Q340 0 340 40 V150 H0Z" fill="#263d38" stroke="#c4c8ad" stroke-opacity=".62" stroke-width="3"/>
          <path d="M18 20 H322 V100 H18Z" fill="#d7d7bb" opacity=".14"/>
          ${[0, 1, 2, 3].map((index) => `<rect x="${28 + index * 76}" y="28" width="54" height="47" rx="5" fill="${palette.moon}" opacity=".84"/>`).join('')}
          <path d="M20 118 H320" stroke="#d6a86a" stroke-width="5" opacity=".8"/>
          <circle cx="64" cy="152" r="18" fill="#0b100e" stroke="#9aab9d" stroke-width="4"/>
          <circle cx="276" cy="152" r="18" fill="#0b100e" stroke="#9aab9d" stroke-width="4"/>
        </g>
      `);
    }

    if (/door|portal|gate|entrance/.test(scene)) {
      details.push(`
        <ellipse cx="640" cy="585" rx="175" ry="28" fill="${palette.glow}" opacity=".2" filter="url(#blur)"/>
        <path d="M535 610 V385 A105 105 0 0 1 745 385 V610Z" fill="#0b100e" stroke="${palette.moon}" stroke-width="5" stroke-opacity=".85"/>
        <path d="M554 610 V388 A86 86 0 0 1 726 388 V610Z" fill="${palette.glow}" opacity=".36"/>
        <path d="M577 610 V392 A63 63 0 0 1 703 392 V610Z" fill="#d9dfc9" opacity=".25"/>
        <circle cx="693" cy="500" r="5" fill="${palette.moon}"/>
      `);
    }

    if (/city|tower|street|building|skyscraper/.test(scene)) {
      details.push(Array.from({ length: 14 }, (_, index) => {
        const x = index * 92 - 20;
        const height = 100 + Math.floor(random() * 180);
        return `<g><path d="M${x} ${610 - height} h68 v${height} h-68Z" fill="#111b17" stroke="#738577" stroke-opacity=".24"/><path d="M${x + 12} ${625 - height} v${height - 28}" stroke="${palette.moon}" stroke-width="3" stroke-dasharray="6 12" opacity=".44"/></g>`;
      }).join(''));
    }

    if (/forest|tree|garden|woods|field/.test(scene)) {
      details.push(Array.from({ length: 19 }, (_, index) => {
        const x = index * 68 - 20;
        const height = 95 + Math.floor(random() * 145);
        return `<g opacity=".9"><path d="M${x + 34} ${640 - height} L${x - 4} 640 H${x + 72}Z" fill="#10251d"/><path d="M${x + 34} ${640 - height * 0.68} L${x + 5} 640 H${x + 63}Z" fill="#1c3a2d"/></g>`;
      }).join(''));
    }

    if (/stair|stairs|step|climb|ladder/.test(scene)) {
      details.push(Array.from({ length: 10 }, (_, index) => {
        const x = 360 + index * 31;
        const y = 600 - index * 30;
        return `<path d="M${x} ${y} h${240 - index * 17} v18 h-${240 - index * 17}Z" fill="#263d34" stroke="${palette.moon}" stroke-opacity=".35" stroke-width="2"/>`;
      }).join(''));
    }

    if (/bird|wing|fly|flying|angel/.test(scene)) {
      details.push(Array.from({ length: 5 }, (_, index) => {
        const x = 250 + index * 120;
        const y = 260 + Math.floor(random() * 90);
        return `<path d="M${x} ${y} q18 -20 36 0 q18 -20 36 0" stroke="${palette.mist}" stroke-width="3" fill="none" opacity=".7"/>`;
      }).join(''));
    }

    return details.join('');
  }
}

module.exports = ImageService;
