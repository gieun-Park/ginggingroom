import assert from 'node:assert/strict';
import test from 'node:test';
import {
  drawLiveComposition,
  drawMirroredSourceCover,
  drawSourceCover,
  mapMirroredPlacementToCanvas
} from '../js/camera-renderer.js';

function contextSpy() {
  const calls = [];
  return {
    calls,
    clearRect: (...args) => calls.push(['clearRect', ...args]),
    drawImage: (...args) => calls.push(['drawImage', ...args]),
    restore: () => calls.push(['restore']),
    save: () => calls.push(['save']),
    scale: (...args) => calls.push(['scale', ...args]),
    translate: (...args) => calls.push(['translate', ...args])
  };
}

test('mirrors source pixels around the canvas width', () => {
  const context = contextSpy();
  const source = { id: 'video' };
  drawMirroredSourceCover(context, source, { width: 400, height: 500 }, { width: 400, height: 500 });
  assert.deepEqual(context.calls, [
    ['save'], ['translate', 400, 0], ['scale', -1, 1],
    ['drawImage', source, 0, 0, 400, 500], ['restore']
  ]);
});

test('mirrors face center and rotation while preserving size', () => {
  assert.deepEqual(
    mapMirroredPlacementToCanvas(
      { centerX: .25, centerY: .5, width: .2, height: .3, rotation: .15 },
      { width: 400, height: 500 },
      { width: 400, height: 500 }
    ),
    {
      centerX: 300,
      centerY: 250,
      width: 80,
      height: 150,
      rotation: -Math.atan2(Math.sin(.15) * 500, Math.cos(.15) * 400)
    }
  );
});

test('draws camera pixels before overlays', () => {
  const context = contextSpy();
  const overlays = [];
  drawLiveComposition({
    context,
    source: { id: 'video' },
    sourceSize: { width: 400, height: 500 },
    canvasSize: { width: 400, height: 500 },
    faces: [{ centerX: .25, centerY: .5, width: .2, height: .3, rotation: 0 }],
    preparedFrame: {},
    frame: {},
    overlayDrawer: (...args) => overlays.push(args)
  });
  assert.equal(context.calls[0][0], 'clearRect');
  assert.equal(context.calls.some(call => call[0] === 'drawImage'), true);
  assert.equal(overlays[0][3][0].centerX, 300);
});

test('draws uploaded sources without mirroring', () => {
  const context = contextSpy();
  const source = { id: 'photo' };
  drawSourceCover(context, source, { width: 400, height: 500 }, { width: 400, height: 500 });
  assert.deepEqual(context.calls, [['drawImage', source, 0, 0, 400, 500]]);
});
