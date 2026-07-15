import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPersonForeground,
  drawPhotoLayer,
  fillCanvasWhite
} from '../js/background-composite.js';

function makeCanvasFactory() {
  const canvases = [];
  function createCanvas(width, height) {
    const operations = [];
    const context = {
      globalCompositeOperation: 'source-over',
      createImageData(imageWidth, imageHeight) {
        return {
          width: imageWidth,
          height: imageHeight,
          data: new Uint8ClampedArray(imageWidth * imageHeight * 4)
        };
      },
      putImageData(imageData, x, y) {
        operations.push({ kind: 'putImageData', imageData, x, y });
      },
      drawImage(...args) {
        operations.push({
          kind: 'drawImage',
          composite: this.globalCompositeOperation,
          args
        });
      }
    };
    const canvas = { width, height, context, operations, getContext: () => context };
    canvases.push(canvas);
    return canvas;
  }
  return { canvases, createCanvas };
}

test('turns confidence values into soft alpha and masks the original photo', () => {
  const factory = makeCanvasFactory();
  const photo = { width: 4, height: 2 };
  const foreground = createPersonForeground(
    photo,
    { width: 2, height: 2, confidence: new Float32Array([0, 0.25, 0.5, 1]) },
    { createCanvas: factory.createCanvas }
  );

  const maskImage = factory.canvases[0].operations[0].imageData;
  assert.deepEqual(
    [maskImage.data[3], maskImage.data[7], maskImage.data[11], maskImage.data[15]],
    [0, 64, 128, 255]
  );
  assert.equal(foreground, factory.canvases[1]);
  assert.deepEqual(factory.canvases[1].operations.map(operation => operation.composite), [
    'source-over',
    'destination-in'
  ]);
  assert.deepEqual(factory.canvases[1].operations[1].args.slice(1), [0, 0, 4, 2]);
});

test('fills white and maps a photo layer through the shared cover transform', () => {
  const operations = [];
  const context = {
    clearRect(...args) { operations.push(['clear', ...args]); },
    fillRect(...args) { operations.push(['fill', this.fillStyle, ...args]); },
    drawImage(...args) { operations.push(['draw', ...args]); },
    fillStyle: ''
  };
  const source = { id: 'foreground' };

  fillCanvasWhite(context, { width: 600, height: 750 });
  drawPhotoLayer(
    context,
    source,
    { width: 1000, height: 500 },
    { width: 600, height: 750 }
  );

  assert.deepEqual(operations, [
    ['clear', 0, 0, 600, 750],
    ['fill', '#fff', 0, 0, 600, 750],
    ['draw', source, -450, 0, 1500, 750]
  ]);
});
