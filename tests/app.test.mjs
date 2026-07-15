import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../js/app.js';
import { FRAMES } from '../js/frame-config.js';

class Element {
  constructor(id = '') {
    this.id = id;
    this.children = [];
    this.listeners = {};
    this.hidden = false;
    this.textContent = '';
    this.style = {};
    const classes = new Set();
    this.classList = {
      add: value => classes.add(value),
      remove: value => classes.delete(value),
      contains: value => classes.has(value)
    };
  }

  appendChild(child) { this.children.push(child); }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  set innerHTML(value) { if (value === '') this.children = []; }
  get innerHTML() { return ''; }
}

function makeLoadedImage(width, height) {
  return { width, height, naturalWidth: width, naturalHeight: height };
}

function makeAppHarness({ faces = [], error = null } = {}) {
  const ids = [
    'canvas', 'photoInput', 'cameraBtn', 'frameGrid', 'resultArea', 'resultImage',
    'downloadBtn', 'resetBtn', 'video', 'faceStatus', 'retryDetectionBtn'
  ];
  const elements = Object.fromEntries(ids.map(id => [id, new Element(id)]));
  elements.resultArea.style.display = 'none';
  const photoDraws = [];
  const context = {
    clearRect() {},
    fillRect() {},
    fillText() {},
    drawImage(...args) { photoDraws.push(args); },
    set fillStyle(value) {},
    set font(value) {},
    set textAlign(value) {}
  };
  elements.canvas.width = 400;
  elements.canvas.height = 500;
  elements.canvas.getContext = () => context;

  const documentRef = {
    getElementById: id => elements[id],
    createElement: () => new Element(),
    querySelectorAll: selector => selector === '.frame-item' ? elements.frameGrid.children : [],
    body: new Element('body')
  };
  const detectorCalls = [];
  const detector = {
    async detectFaces(photo) {
      detectorCalls.push(photo);
      if (error) throw error;
      return faces;
    },
    reset() {}
  };
  const frameImages = new Map(
    FRAMES.slice(0, 2).map(frame => [frame.id, makeLoadedImage(480, 480)])
  );
  const drawCalls = [];
  const app = createApp({
    documentRef,
    windowRef: { navigator: {}, addEventListener() {} },
    detector,
    frameImages,
    framePreloader: () => {},
    framePreparer: () => ({ width: 480, height: 480 }),
    overlayDrawer(contextArg, prepared, frame, placements) {
      placements.forEach(placement => drawCalls.push({ kind: 'overlay', frame, placement }));
    }
  });
  return { app, elements, drawCalls, detectorCalls, photoDraws };
}

test('draws one selected frame for every detected face and does not redetect on frame changes', async () => {
  const { app, elements, drawCalls, detectorCalls } = makeAppHarness({
    faces: [
      { centerX: 0.3, centerY: 0.4, width: 0.2, height: 0.3, rotation: 0 },
      { centerX: 0.7, centerY: 0.4, width: 0.2, height: 0.3, rotation: 0 }
    ]
  });
  app.init();
  await app.setPhoto(makeLoadedImage(1000, 500));
  elements.frameGrid.children[0].listeners.click();
  assert.equal(drawCalls.filter(call => call.kind === 'overlay').length, 2);
  elements.frameGrid.children[1].listeners.click();
  assert.equal(detectorCalls.length, 1);
});

test('keeps the photo visible and shows retry when detection fails', async () => {
  const { app, elements, photoDraws } = makeAppHarness({ error: new Error('model failed') });
  app.init();
  await app.setPhoto(makeLoadedImage(400, 500));
  assert.ok(photoDraws.length > 0);
  assert.equal(elements.resultArea.style.display, 'block');
  assert.equal(elements.faceStatus.textContent, '얼굴 인식을 불러오지 못했어요.');
  assert.equal(elements.retryDetectionBtn.hidden, false);
});

test('shows result controls for a retained photo and hides them on reset', async () => {
  const { app, elements } = makeAppHarness({
    faces: [{ centerX: 0.5, centerY: 0.5, width: 0.2, height: 0.3, rotation: 0 }]
  });
  app.init();
  assert.equal(elements.resultArea.style.display, 'none');

  await app.setPhoto(makeLoadedImage(400, 500));
  assert.equal(elements.resultArea.style.display, 'block');

  elements.resetBtn.listeners.click();
  assert.equal(elements.resultArea.style.display, 'none');
});

test('keeps result controls available when no face is found', async () => {
  const { app, elements } = makeAppHarness({ faces: [] });
  app.init();
  await app.setPhoto(makeLoadedImage(400, 500));
  assert.equal(elements.resultArea.style.display, 'block');
});

test('reset clears the cached analysis and status', async () => {
  const { app, elements } = makeAppHarness({ faces: [] });
  app.init();
  await app.setPhoto(makeLoadedImage(400, 500));
  elements.resetBtn.listeners.click();
  assert.equal(elements.faceStatus.textContent, '');
  assert.equal(app.getState().currentPhoto, null);
});
