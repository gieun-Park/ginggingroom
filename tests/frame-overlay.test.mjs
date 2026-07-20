import assert from 'node:assert/strict';
import test from 'node:test';
import { drawFrameOverlays, prepareFrameImage } from '../js/frame-overlay.js';

function makeContext({ width = 600, height = 750 } = {}) {
  const calls = [];
  return {
    calls,
    canvas: { width, height },
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

const pairedFrame = {
  faceAnchor: { centerX: 0.3, centerY: 0.5, width: 0.1, height: 0.1 },
  maskAnchors: [
    { centerX: 0.3, centerY: 0.5, width: 0.1, height: 0.1 },
    { centerX: 0.7, centerY: 0.5, width: 0.15, height: 0.15 }
  ],
  fitPadding: 1.08,
  layout: {
    mode: 'paired',
    contentBounds: { left: 0.1, top: 0.2, right: 0.9, bottom: 0.8 },
    viewportPadding: 0.04
  }
};

const faceFitPairedFrame = {
  ...pairedFrame,
  layout: {
    ...pairedFrame.layout,
    scaleMode: 'face'
  }
};

test('erases every configured face placeholder with a 1.5 pixel edge cleanup', () => {
  const context = makeContext();
  const canvas = { width: 0, height: 0, getContext: () => context };
  const frameImage = { naturalWidth: 480, naturalHeight: 480 };
  const prepared = prepareFrameImage(
    frameImage,
    frame,
    { createCanvas: () => canvas }
  );
  assert.equal(prepared, canvas);
  assert.deepEqual(context.calls, [
    ['drawImage', frameImage, 0, 0, 480, 480],
    ['beginPath'],
    ['ellipse', 240, 192, 49.5, 49.5, 0, 0, Math.PI * 2],
    ['fill', 'destination-out'],
    ['beginPath'],
    ['ellipse', 336, 192, 25.5, 25.5, 0, 0, Math.PI * 2],
    ['fill', 'destination-out']
  ]);
  assert.equal(context.globalCompositeOperation, 'source-over');
});

test('composes mask scaling and edge cleanup independently', () => {
  const context = makeContext();
  const canvas = { width: 0, height: 0, getContext: () => context };
  const frameImage = { naturalWidth: 480, naturalHeight: 480 };

  prepareFrameImage(frameImage, frame, {
    createCanvas: () => canvas,
    maskScale: 1.25
  });

  assert.deepEqual(
    context.calls.filter(call => call[0] === 'ellipse'),
    [
      ['ellipse', 240, 192, 61.5, 61.5, 0, 0, Math.PI * 2],
      ['ellipse', 336, 192, 31.5, 31.5, 0, 0, Math.PI * 2]
    ]
  );
});

test('normalizes an invalid mask scale before applying edge cleanup', () => {
  const context = makeContext();
  const canvas = { width: 0, height: 0, getContext: () => context };
  const frameImage = { naturalWidth: 480, naturalHeight: 480 };

  prepareFrameImage(frameImage, frame, {
    createCanvas: () => canvas,
    maskScale: Number.NaN
  });

  assert.deepEqual(
    context.calls.filter(call => call[0] === 'ellipse'),
    [
      ['ellipse', 240, 192, 49.5, 49.5, 0, 0, Math.PI * 2],
      ['ellipse', 336, 192, 25.5, 25.5, 0, 0, Math.PI * 2]
    ]
  );
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

test('scales costume artwork without moving the face anchor', () => {
  const context = makeContext();
  const prepared = { width: 480, height: 480 };
  const placement = {
    centerX: 100,
    centerY: 120,
    width: 40,
    height: 45,
    rotation: 0.1
  };
  const baseScale = Math.max(
    placement.width * frame.fitPadding / (frame.faceAnchor.width * prepared.width),
    placement.height * frame.fitPadding / (frame.faceAnchor.height * prepared.height)
  );

  drawFrameOverlays(context, prepared, frame, [placement], 0.8);

  assert.deepEqual(
    context.calls.find(call => call[0] === 'translate'),
    ['translate', 100, 120]
  );
  assert.deepEqual(
    context.calls.find(call => call[0] === 'scale'),
    ['scale', baseScale * 0.8, baseScale * 0.8]
  );
});

test('draws a paired frame once on the nearest left slot within viewport padding', () => {
  const context = makeContext();
  const prepared = { width: 480, height: 480 };
  const placements = [
    { centerX: 150, centerY: 375, width: 120, height: 225, rotation: 0.4 },
    { centerX: 450, centerY: 375, width: 100, height: 180, rotation: -0.2 }
  ];

  drawFrameOverlays(context, prepared, pairedFrame, placements, 0.8);

  const drawCalls = context.calls.filter(call => call[0] === 'drawImage');
  const scale = context.calls.find(call => call[0] === 'scale')[1];
  const margin = Math.min(context.canvas.width, context.canvas.height) * 0.04;
  const anchorX = pairedFrame.maskAnchors[0].centerX * prepared.width;
  const anchorY = pairedFrame.maskAnchors[0].centerY * prepared.height;
  assert.equal(drawCalls.length, 1);
  assert.deepEqual(
    context.calls.find(call => call[0] === 'translate'),
    ['translate', 150, 375]
  );
  assert.deepEqual(drawCalls[0], ['drawImage', prepared, -anchorX, -anchorY]);
  assert.equal(context.calls.some(call => call[0] === 'rotate'), false);
  assert.ok(
    150 + (pairedFrame.layout.contentBounds.left * 480 - anchorX) * scale >= margin
  );
  assert.ok(
    150 + (pairedFrame.layout.contentBounds.right * 480 - anchorX) * scale
      <= context.canvas.width - margin
  );
  assert.ok(
    375 + (pairedFrame.layout.contentBounds.top * 480 - anchorY) * scale >= margin
  );
  assert.ok(
    375 + (pairedFrame.layout.contentBounds.bottom * 480 - anchorY) * scale
      <= context.canvas.height - margin
  );
});

test('aligns a paired frame to the right slot for a face in the right half', () => {
  const context = makeContext();
  const prepared = { width: 480, height: 480 };
  const placement = {
    centerX: 450,
    centerY: 375,
    width: 120,
    height: 225,
    rotation: 0.4
  };

  drawFrameOverlays(context, prepared, pairedFrame, [placement], 0.8);

  const anchor = pairedFrame.maskAnchors[1];
  assert.deepEqual(
    context.calls.find(call => call[0] === 'drawImage'),
    ['drawImage', prepared, -anchor.centerX * 480, -anchor.centerY * 480]
  );
});

test('uses the full face-fit scale for a paired single-face layout', () => {
  const context = makeContext();
  const prepared = { width: 480, height: 480 };
  const placement = {
    centerX: 450,
    centerY: 375,
    width: 120,
    height: 225,
    rotation: 0.4
  };
  const anchor = faceFitPairedFrame.maskAnchors[1];
  const expectedScale = Math.max(
    placement.width * faceFitPairedFrame.fitPadding / (anchor.width * prepared.width),
    placement.height * faceFitPairedFrame.fitPadding / (anchor.height * prepared.height)
  ) * 0.8;

  drawFrameOverlays(
    context,
    prepared,
    faceFitPairedFrame,
    [
      placement,
      { centerX: 150, centerY: 375, width: 100, height: 180, rotation: -0.2 }
    ],
    0.8
  );

  assert.deepEqual(
    context.calls.find(call => call[0] === 'scale'),
    ['scale', expectedScale, expectedScale]
  );
  assert.deepEqual(
    context.calls.filter(call => call[0] === 'drawImage'),
    [[
      'drawImage',
      prepared,
      -anchor.centerX * prepared.width,
      -anchor.centerY * prepared.height
    ]]
  );
  assert.equal(context.calls.some(call => call[0] === 'ellipse'), false);
});

test('falls back to per-face drawing when paired metadata is invalid', () => {
  const context = makeContext();
  const prepared = { width: 480, height: 480 };
  const malformedFrame = {
    ...pairedFrame,
    layout: { mode: 'paired' }
  };
  const placements = [
    { centerX: 150, centerY: 375, width: 120, height: 225, rotation: 0.4 },
    { centerX: 450, centerY: 375, width: 100, height: 180, rotation: -0.2 }
  ];

  drawFrameOverlays(context, prepared, malformedFrame, placements, 0.8);

  assert.equal(
    context.calls.filter(call => call[0] === 'drawImage').length,
    2
  );
  assert.deepEqual(
    context.calls.filter(call => call[0] === 'rotate'),
    [['rotate', 0.4], ['rotate', -0.2]]
  );
});
