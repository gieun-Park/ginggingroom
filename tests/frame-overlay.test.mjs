import assert from 'node:assert/strict';
import test from 'node:test';
import { drawFrameOverlays, prepareFrameImage } from '../js/frame-overlay.js';

function makeContext() {
  const calls = [];
  return {
    calls,
    globalCompositeOperation: 'source-over',
    beginPath() { calls.push(['beginPath']); },
    ellipse(...args) { calls.push(['ellipse', ...args]); },
    fill() { calls.push(['fill', this.globalCompositeOperation]); },
    drawImage(...args) { calls.push(['drawImage', ...args]); },
    save() { calls.push(['save']); },
    restore() { calls.push(['restore']); },
    translate(...args) { calls.push(['translate', ...args]); },
    rotate(...args) { calls.push(['rotate', ...args]); },
    scale(...args) { calls.push(['scale', ...args]); }
  };
}

const frame = {
  faceAnchor: { centerX: 0.5, centerY: 0.4, width: 0.2, height: 0.2 },
  maskAnchors: [
    { centerX: 0.5, centerY: 0.4, width: 0.2, height: 0.2 },
    { centerX: 0.7, centerY: 0.4, width: 0.1, height: 0.1 }
  ],
  fitPadding: 1.08
};

test('erases every configured face placeholder in an offscreen canvas', () => {
  const context = makeContext();
  const canvas = { width: 0, height: 0, getContext: () => context };
  const prepared = prepareFrameImage(
    { naturalWidth: 480, naturalHeight: 480 },
    frame,
    () => canvas
  );
  assert.equal(prepared, canvas);
  assert.equal(context.calls.filter(([name]) => name === 'ellipse').length, 2);
  assert.equal(context.calls.filter(([name]) => name === 'fill')[0][1], 'destination-out');
});

test('draws one aspect-preserving transformed frame for every placement', () => {
  const context = makeContext();
  const prepared = { width: 480, height: 480 };
  drawFrameOverlays(context, prepared, frame, [
    { centerX: 100, centerY: 120, width: 40, height: 45, rotation: 0.1 },
    { centerX: 250, centerY: 220, width: 30, height: 35, rotation: -0.2 }
  ]);
  assert.equal(context.calls.filter(([name]) => name === 'drawImage').length, 2);
  const scales = context.calls.filter(([name]) => name === 'scale');
  scales.forEach(([, scaleX, scaleY]) => assert.equal(scaleX, scaleY));
});
