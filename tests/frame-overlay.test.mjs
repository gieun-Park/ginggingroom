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
  const frameImage = { naturalWidth: 480, naturalHeight: 480 };
  const prepared = prepareFrameImage(
    frameImage,
    frame,
    () => canvas
  );
  assert.equal(prepared, canvas);
  assert.deepEqual(context.calls, [
    ['drawImage', frameImage, 0, 0, 480, 480],
    ['beginPath'],
    ['ellipse', 240, 192, 48, 48, 0, 0, Math.PI * 2],
    ['fill', 'destination-out'],
    ['beginPath'],
    ['ellipse', 336, 192, 24, 24, 0, 0, Math.PI * 2],
    ['fill', 'destination-out']
  ]);
  assert.equal(context.globalCompositeOperation, 'source-over');
});

test('draws one aspect-preserving transformed frame for every placement', () => {
  const context = makeContext();
  const prepared = { width: 480, height: 480 };
  const placements = [
    { centerX: 100, centerY: 120, width: 40, height: 45, rotation: 0.1 },
    { centerX: 250, centerY: 220, width: 30, height: 35, rotation: -0.2 }
  ];
  const anchorWidth = frame.faceAnchor.width * prepared.width;
  const anchorHeight = frame.faceAnchor.height * prepared.height;
  const firstScale = Math.max(
    placements[0].width * frame.fitPadding / anchorWidth,
    placements[0].height * frame.fitPadding / anchorHeight
  );
  const secondScale = Math.max(
    placements[1].width * frame.fitPadding / anchorWidth,
    placements[1].height * frame.fitPadding / anchorHeight
  );

  drawFrameOverlays(context, prepared, frame, placements);

  assert.deepEqual(context.calls, [
    ['save'],
    ['translate', 100, 120],
    ['rotate', 0.1],
    ['scale', firstScale, firstScale],
    ['drawImage', prepared, -240, -192],
    ['restore'],
    ['save'],
    ['translate', 250, 220],
    ['rotate', -0.2],
    ['scale', secondScale, secondScale],
    ['drawImage', prepared, -240, -192],
    ['restore']
  ]);
});
