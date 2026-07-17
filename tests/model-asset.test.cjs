const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const test = require('node:test');

test('ships the local MediaPipe face landmarker model', () => {
  const model = fs.readFileSync('assets/models/face_landmarker.task');
  const stat = fs.statSync('assets/models/face_landmarker.task');
  assert.ok(stat.size > 1_000_000);
  assert.equal(
    crypto.createHash('sha256').update(model).digest('hex'),
    '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff'
  );
});

test('does not ship retired background segmentation files', () => {
  [
    'assets/models/selfie_segmenter.tflite',
    'js/background-composite.js',
    'js/background-segmentation.js',
    'js/background-session.js'
  ].forEach(path => assert.equal(fs.existsSync(path), false, path));
});
