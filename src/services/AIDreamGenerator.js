const crypto = require('node:crypto');

class AIDreamGenerator {
  static templates = [
    [
      'A lighthouse in a desert under the moon',
      'A lighthouse stood in a desert, shining into a sky full of slow-moving fish.',
    ],
    [
      'Rain falling upward',
      'Rain rose from a quiet town and gathered into silver clouds beneath the streets.',
    ],
    [
      'The staircase beyond the stars',
      'A staircase of glass climbed into a cloud sky, and each step remembered a different life.',
    ],
    [
      'The library under the ocean',
      'Books drifted like jellyfish in the deep sea. Reading one let me breathe water.',
    ],
    [
      'The train that forgot its destination',
      'A midnight train crossed a city made of memories and stopped at a station that had never existed.',
    ],
  ];

  static generate() {
    const [title, story] = AIDreamGenerator.templates[
      crypto.randomInt(AIDreamGenerator.templates.length)
    ];
    const moods = ['Surreal', 'Lucid', 'Recurring'];

    return {
      title,
      story,
      mood: moods[crypto.randomInt(moods.length)],
      author: 'Unknown',
      ai: true,
    };
  }
}

module.exports = AIDreamGenerator;
