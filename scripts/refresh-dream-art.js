require('dotenv').config();
const db = require('../src/db/database');
const ImageService = require('../src/services/ImageService');

async function main() {
  const dreams = db.prepare('SELECT id, title, story, mood FROM dreams ORDER BY id').all();
  const update = db.prepare(`UPDATE dreams SET image_url = ?, image_credit = ?, image_license = ?, image_source_url = ? WHERE id = ?`);
  let curated = 0;
  let procedural = 0;
  for (const dream of dreams) {
    const local = await ImageService.findCuratedAsset(dream.title);
    const artwork = local || {
      url: ImageService.procedural(dream.title, dream.story, dream.mood),
      credit: null,
      license: 'Locally generated SVG artwork',
      sourceUrl: null,
    };
    update.run(artwork.url, artwork.credit, artwork.license, artwork.sourceUrl, dream.id);
    if (local) curated += 1; else procedural += 1;
    console.log(`[artwork] Dream #${dream.id}: ${dream.title} -> ${local ? 'curated local asset' : 'local procedural artwork'}`);
  }
  console.log(`Done. Updated ${dreams.length} dreams (${curated} curated assets, ${procedural} procedural). No Pixabay API calls were made.`);
  db.close();
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
