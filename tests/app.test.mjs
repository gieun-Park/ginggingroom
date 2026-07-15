import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createApp } from '../js/app.js';
import { FRAMES } from '../js/frame-config.js';

const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
const resultAreaMarkup = indexHtml.match(/<section class="result-area"[\s\S]*?<\/section>/)?.[0] ?? '';

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
  click() { this.clickCount = (this.clickCount ?? 0) + 1; }
  set innerHTML(value) { if (value === '') this.children = []; }
  get innerHTML() { return ''; }
}

function makeLoadedImage(width, height) {
  return { width, height, naturalWidth: width, naturalHeight: height };
}

const DEFAULT_MASK = {
  width: 1,
  height: 1,
  confidence: new Float32Array([1])
};

function makeAppHarness({
  faces = [],
  error = null,
  backgroundOutcomes = [DEFAULT_MASK],
  windowRef = {}
} = {}) {
  const ids = [
    'canvas', 'photoInput', 'cameraBtn', 'frameGrid', 'resultArea',
    'downloadBtn', 'resetBtn', 'video', 'faceStatus', 'retryDetectionBtn',
    'backgroundStatus', 'retryBackgroundBtn'
  ];
  const elements = Object.fromEntries(ids.map(id => [id, new Element(id)]));
  elements.resultArea.style.display = 'none';
  const photoDraws = [];
  const renderCalls = [];
  const context = {
    clearRect() {},
    fillRect() { renderCalls.push('white'); },
    fillText() {},
    drawImage(...args) { photoDraws.push(args); },
    set fillStyle(value) {},
    set font(value) {},
    set textAlign(value) {}
  };
  elements.canvas.width = 400;
  elements.canvas.height = 500;
  elements.canvas.getContext = () => context;
  elements.canvas.toDataURL = () => 'data:image/png;base64,PHOTO';

  const createdElements = [];
  const documentRef = {
    getElementById: id => elements[id],
    createElement: tagName => {
      const element = new Element();
      element.tagName = tagName;
      createdElements.push(element);
      return element;
    },
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
  const segmenterCalls = [];
  const segmenterResets = [];
  const foregroundBuilds = [];
  const foreground = makeLoadedImage(400, 500);
  let backgroundAttempt = 0;
  const backgroundSegmenter = {
    async segmentPeople(photo) {
      segmenterCalls.push(photo);
      const outcome = backgroundOutcomes[
        Math.min(backgroundAttempt, backgroundOutcomes.length - 1)
      ];
      backgroundAttempt += 1;
      if (outcome instanceof Error) throw outcome;
      return await outcome;
    },
    reset() {
      segmenterResets.push(true);
    }
  };
  const frameImages = new Map(
    FRAMES.slice(0, 2).map(frame => [frame.id, makeLoadedImage(480, 480)])
  );
  const drawCalls = [];
  const app = createApp({
    documentRef,
    windowRef: { navigator: {}, addEventListener() {}, ...windowRef },
    detector,
    backgroundSegmenter,
    foregroundBuilder(photo, mask) {
      foregroundBuilds.push({ photo, mask });
      return foreground;
    },
    photoLayerDrawer(contextArg, source) {
      renderCalls.push(source === foreground ? 'foreground' : 'fallback');
      contextArg.drawImage(source, 0, 0);
    },
    frameImages,
    framePreloader: () => {},
    framePreparer: () => ({ width: 480, height: 480 }),
    overlayDrawer(contextArg, prepared, frame, placements) {
      renderCalls.push('overlay');
      placements.forEach(placement => {
        drawCalls.push({ kind: 'overlay', frame, placement });
      });
    }
  });
  return {
    app,
    elements,
    drawCalls,
    detectorCalls,
    photoDraws,
    renderCalls,
    segmenterCalls,
    segmenterResets,
    foregroundBuilds,
    foreground,
    createdElements
  };
}

function makeDecodeWindow() {
  const readers = [];
  const images = [];

  class ControlledFileReader {
    constructor() {
      readers.push(this);
    }

    readAsDataURL(file) {
      this.file = file;
    }
  }

  class ControlledImage {
    constructor() {
      this.width = 640;
      this.height = 480;
      this.naturalWidth = 640;
      this.naturalHeight = 480;
      images.push(this);
    }
  }

  return { FileReader: ControlledFileReader, Image: ControlledImage, readers, images };
}

function selectUpload(elements, file) {
  elements.photoInput.files = file ? [file] : [];
  elements.photoInput.listeners.change({ target: elements.photoInput });
}

test('uses neutral copy for the retained-photo action area', () => {
  assert.match(resultAreaMarkup, /<h2>\s*사진 저장 또는 다시 시작\s*<\/h2>/);
  assert.doesNotMatch(resultAreaMarkup, /사진이 완성되었습니다/);
});

test('does not render an unused image in the retained-photo action area', () => {
  assert.doesNotMatch(resultAreaMarkup, /result-preview|resultImage|<img\b/);
});

test('does not retain dead result preview bindings or styles', () => {
  assert.doesNotMatch(appSource, /resultImage/);
  assert.doesNotMatch(stylesSource, /\.result-preview\b/);
});

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

test('keeps download disabled until both photo analyses settle', async () => {
  let resolveFaces;
  let resolveMask;
  const pendingFaces = new Promise(resolve => { resolveFaces = resolve; });
  const pendingMask = new Promise(resolve => { resolveMask = resolve; });
  const { app, elements } = makeAppHarness({
    faces: pendingFaces,
    backgroundOutcomes: [pendingMask]
  });
  app.init();

  const pendingPhoto = app.setPhoto(makeLoadedImage(400, 500));
  assert.equal(elements.downloadBtn.disabled, true);

  resolveFaces([]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.getState().analysis.status, 'empty');
  assert.equal(elements.downloadBtn.disabled, true);

  resolveMask(DEFAULT_MASK);
  await pendingPhoto;
  assert.equal(elements.downloadBtn.disabled, false);
});

test('disables download again for a new photo and reset', async () => {
  let resolveSecondMask;
  const secondMask = new Promise(resolve => { resolveSecondMask = resolve; });
  const { app, elements } = makeAppHarness({
    faces: [],
    backgroundOutcomes: [DEFAULT_MASK, secondMask]
  });
  app.init();
  assert.equal(elements.downloadBtn.disabled, true);

  await app.setPhoto(makeLoadedImage(400, 500));
  assert.equal(elements.downloadBtn.disabled, false);

  const secondPhoto = app.setPhoto(makeLoadedImage(600, 800));
  assert.equal(elements.downloadBtn.disabled, true);
  resolveSecondMask(DEFAULT_MASK);
  await secondPhoto;
  assert.equal(elements.downloadBtn.disabled, false);

  elements.resetBtn.listeners.click();
  assert.equal(elements.downloadBtn.disabled, true);
});

test('disables download while a failed background analysis is retried', async () => {
  let resolveRetryMask;
  const retryMask = new Promise(resolve => { resolveRetryMask = resolve; });
  const { app, elements } = makeAppHarness({
    faces: [],
    backgroundOutcomes: [new Error('segment failed'), retryMask]
  });
  app.init();
  await app.setPhoto(makeLoadedImage(400, 500));
  assert.equal(elements.downloadBtn.disabled, false);

  const retry = elements.retryBackgroundBtn.listeners.click();
  assert.equal(elements.downloadBtn.disabled, true);
  resolveRetryMask(DEFAULT_MASK);
  await retry;
  assert.equal(elements.downloadBtn.disabled, false);
});

test('ignores programmatic download clicks while processing is incomplete', () => {
  const { app, elements, createdElements } = makeAppHarness();
  app.init();
  const createdBeforeClick = createdElements.length;

  elements.downloadBtn.listeners.click();

  assert.equal(createdElements.length, createdBeforeClick);
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

test('keeps the newest upload when image decodes finish out of order', () => {
  const decodeWindow = makeDecodeWindow();
  const { app, elements } = makeAppHarness({ windowRef: decodeWindow });
  app.init();

  selectUpload(elements, { name: 'a.png' });
  decodeWindow.readers[0].onload({ target: { result: 'data:image/png;base64,A' } });
  const imageA = decodeWindow.images[0];

  selectUpload(elements, { name: 'b.png' });
  decodeWindow.readers[1].onload({ target: { result: 'data:image/png;base64,B' } });
  const imageB = decodeWindow.images[1];

  imageB.onload();
  imageA.onload();

  assert.equal(app.getState().currentPhoto, imageB);
});

test('ignores an older upload whose file read finishes after a new selection', () => {
  const decodeWindow = makeDecodeWindow();
  const { app, elements } = makeAppHarness({ windowRef: decodeWindow });
  app.init();

  selectUpload(elements, { name: 'a.png' });
  selectUpload(elements, { name: 'b.png' });
  decodeWindow.readers[1].onload({ target: { result: 'data:image/png;base64,B' } });
  decodeWindow.readers[0].onload({ target: { result: 'data:image/png;base64,A' } });

  assert.equal(decodeWindow.images.length, 1);
  decodeWindow.images[0].onload();
  assert.equal(app.getState().currentPhoto, decodeWindow.images[0]);
});

test('reset prevents a pending image decode from restoring the photo', () => {
  const decodeWindow = makeDecodeWindow();
  const { app, elements } = makeAppHarness({ windowRef: decodeWindow });
  app.init();

  selectUpload(elements, { name: 'a.png' });
  decodeWindow.readers[0].onload({ target: { result: 'data:image/png;base64,A' } });
  const imageA = decodeWindow.images[0];
  elements.resetBtn.listeners.click();
  imageA.onload();

  assert.equal(app.getState().currentPhoto, null);
  assert.equal(elements.resultArea.style.display, 'none');
});

test('reset prevents a pending file read from starting image decode', () => {
  const decodeWindow = makeDecodeWindow();
  const { app, elements } = makeAppHarness({ windowRef: decodeWindow });
  app.init();

  selectUpload(elements, { name: 'a.png' });
  elements.resetBtn.listeners.click();
  decodeWindow.readers[0].onload({ target: { result: 'data:image/png;base64,A' } });

  assert.equal(decodeWindow.images.length, 0);
  assert.equal(app.getState().currentPhoto, null);
});

test('an empty upload selection invalidates an older pending file read', () => {
  const decodeWindow = makeDecodeWindow();
  const { app, elements } = makeAppHarness({ windowRef: decodeWindow });
  app.init();

  selectUpload(elements, { name: 'a.png' });
  selectUpload(elements, null);
  decodeWindow.readers[0].onload({ target: { result: 'data:image/png;base64,A' } });

  assert.equal(decodeWindow.images.length, 0);
  assert.equal(app.getState().currentPhoto, null);
});

test('a photo from another source invalidates a pending upload decode', async () => {
  const decodeWindow = makeDecodeWindow();
  const { app, elements } = makeAppHarness({ windowRef: decodeWindow });
  app.init();

  selectUpload(elements, { name: 'upload.png' });
  decodeWindow.readers[0].onload({ target: { result: 'data:image/png;base64,UPLOAD' } });
  const pendingUpload = decodeWindow.images[0];
  const cameraPhoto = makeLoadedImage(800, 600);

  await app.setPhoto(cameraPhoto);
  pendingUpload.onload();

  assert.equal(app.getState().currentPhoto, cameraPhoto);
});

test('draws white, cached foreground, then overlays and reuses both analyses on frame changes', async () => {
  const harness = makeAppHarness({
    faces: [{ centerX: 0.5, centerY: 0.5, width: 0.2, height: 0.3, rotation: 0 }]
  });
  harness.app.init();
  await harness.app.setPhoto(makeLoadedImage(400, 500));
  harness.elements.frameGrid.children[0].listeners.click();

  harness.renderCalls.length = 0;
  harness.app.renderCanvas();
  assert.deepEqual(harness.renderCalls, ['white', 'foreground', 'overlay']);
  assert.equal(harness.drawCalls.at(-1).kind, 'overlay');

  harness.elements.frameGrid.children[1].listeners.click();
  assert.equal(harness.detectorCalls.length, 1);
  assert.equal(harness.segmenterCalls.length, 1);
  assert.equal(harness.foregroundBuilds.length, 1);
});

test('keeps the preview white while background segmentation is loading', async () => {
  let resolveMask;
  const pendingMask = new Promise(resolve => { resolveMask = resolve; });
  const controlled = makeAppHarness({ backgroundOutcomes: [pendingMask] });
  controlled.app.init();
  const pendingPhoto = controlled.app.setPhoto(makeLoadedImage(400, 500));
  controlled.renderCalls.length = 0;
  controlled.app.renderCanvas();
  assert.deepEqual(controlled.renderCalls, ['white']);

  resolveMask(DEFAULT_MASK);
  await pendingPhoto;
});

test('keeps a frame selected before a photo and applies it after both analyses finish', async () => {
  const harness = makeAppHarness({
    faces: [{ centerX: 0.5, centerY: 0.5, width: 0.2, height: 0.3, rotation: 0 }]
  });
  harness.app.init();
  harness.elements.frameGrid.children[0].listeners.click();
  await harness.app.setPhoto(makeLoadedImage(400, 500));

  assert.equal(harness.elements.frameGrid.children[0].classList.contains('active'), true);
  assert.equal(harness.drawCalls.at(-1).kind, 'overlay');
  assert.equal(harness.detectorCalls.length, 1);
  assert.equal(harness.segmenterCalls.length, 1);
});

test('shows original fallback and retries background without redetecting faces', async () => {
  const harness = makeAppHarness({
    faces: [{ centerX: 0.5, centerY: 0.5, width: 0.2, height: 0.3, rotation: 0 }],
    backgroundOutcomes: [new Error('segment failed'), DEFAULT_MASK]
  });
  harness.app.init();
  await harness.app.setPhoto(makeLoadedImage(400, 500));
  assert.equal(
    harness.elements.backgroundStatus.textContent,
    '배경을 지우지 못했어요. 원본 사진으로 표시합니다.'
  );
  assert.equal(harness.elements.retryBackgroundBtn.hidden, false);
  harness.elements.frameGrid.children[0].listeners.click();

  harness.renderCalls.length = 0;
  harness.app.renderCanvas();
  assert.deepEqual(harness.renderCalls, ['white', 'fallback', 'overlay']);
  await harness.elements.retryBackgroundBtn.listeners.click();
  assert.equal(harness.elements.backgroundStatus.textContent, '흰색 배경을 적용했어요.');
  assert.equal(harness.detectorCalls.length, 1);
  assert.equal(harness.segmenterCalls.length, 2);
  assert.equal(harness.segmenterResets.length, 1);
});

test('reset clears background state, status, and cached foreground', async () => {
  const harness = makeAppHarness();
  harness.app.init();
  await harness.app.setPhoto(makeLoadedImage(400, 500));
  harness.elements.resetBtn.listeners.click();

  assert.equal(harness.app.getState().background.status, 'idle');
  assert.equal(harness.app.getState().background.foreground, null);
  assert.equal(harness.elements.backgroundStatus.textContent, '');
  assert.equal(harness.elements.retryBackgroundBtn.hidden, true);
});

test('exposes independent accessible background status and retry controls', () => {
  assert.match(indexHtml, /id="backgroundStatus"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(indexHtml, /id="retryBackgroundBtn"[^>]*hidden/);
  assert.match(indexHtml, />\s*배경 다시 시도\s*</);
});
