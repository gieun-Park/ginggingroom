const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('ships the local MediaPipe face landmarker model', () => {
  const stat = fs.statSync('assets/models/face_landmarker.task');
  assert.ok(stat.size > 1_000_000);
});
