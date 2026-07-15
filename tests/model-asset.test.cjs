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

test('ships the pinned local MediaPipe selfie segmenter model', () => {
  const modelPath = 'assets/models/selfie_segmenter.tflite';
  const model = fs.readFileSync(modelPath);
  const stat = fs.statSync(modelPath);
  assert.equal(stat.size, 249_537);
  assert.equal(
    crypto.createHash('sha256').update(model).digest('hex'),
    '191ac9529ae506ee0beefa6b2c945a172dab9d07d1e802a290a4e4038226658b'
  );
});
