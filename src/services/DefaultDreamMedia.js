const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const ASSET_ROOT = path.join(PROJECT_ROOT, 'public', 'assets');

function normalizeDreamTitle(title) {
  return String(title || '')
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function readMap(filename) {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(ASSET_ROOT, filename), 'utf8'));
    return Object.fromEntries(Object.entries(value).map(([title, asset]) => [normalizeDreamTitle(title), asset]));
  } catch {
    return {};
  }
}

function resolveDefaultImage(title) {
  const filename = readMap('dream-images.json')[normalizeDreamTitle(title)];
  if (!filename || path.basename(filename) !== filename || !/^[\w.-]+\.(?:png|jpe?g|webp)$/i.test(filename)) return null;
  const fullPath = path.join(ASSET_ROOT, 'dreams', filename);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return null;
  return `/assets/dreams/${encodeURIComponent(filename)}`;
}

function resolveDefaultVideo(title) {
  const filename = readMap('dream-videos.json')[normalizeDreamTitle(title)];
  if (!filename || path.basename(filename) !== filename || !/^[\w.-]+\.mp4$/i.test(filename)) return null;
  const fullPath = path.join(ASSET_ROOT, 'dream-videos', filename);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return null;
  return `/assets/dream-videos/${encodeURIComponent(filename)}`;
}

module.exports = { normalizeDreamTitle, resolveDefaultImage, resolveDefaultVideo };
