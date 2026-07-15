import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SELFIE_SEGMENTER_MODEL_URL,
  createBackgroundSegmentationService
} from '../js/background-segmentation.js';
import { MEDIAPIPE_MODULE_URL, MEDIAPIPE_WASM_ROOT } from '../js/face-detection.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function makeRuntime({
  floatData = new Float32Array([0, 0.25, 0.75, 1]),
  confidenceMaskCount = 2
} = {}) {
  const calls = {
    wasmRoot: null,
    options: null,
    segments: 0,
    closes: Array(confidenceMaskCount).fill(0)
  };
  const masks = Array.from({ length: confidenceMaskCount }, (_, index) => ({
    width: 2,
    height: 2,
    getAsFloat32Array: () => index === confidenceMaskCount - 1
      ? floatData
      : new Float32Array(4),
    close: () => { calls.closes[index] += 1; }
  }));
  const segmenter = {
    segment() {
      calls.segments += 1;
      return { confidenceMasks: masks };
    }
  };
  const runtime = {
    FilesetResolver: {
      async forVisionTasks(wasmRoot) {
        calls.wasmRoot = wasmRoot;
        return { kind: 'vision' };
      }
    },
    ImageSegmenter: {
      async createFromOptions(vision, options) {
        assert.deepEqual(vision, { kind: 'vision' });
        calls.options = options;
        return segmenter;
      }
    }
  };
  return { calls, runtime };
}

test('uses the pinned runtime and local person-confidence model configuration', async () => {
  assert.equal(MEDIAPIPE_MODULE_URL.includes('@mediapipe/tasks-vision@0.10.35'), true);
  assert.equal(MEDIAPIPE_WASM_ROOT.includes('@mediapipe/tasks-vision@0.10.35/wasm'), true);
  assert.equal(SELFIE_SEGMENTER_MODEL_URL.endsWith('/assets/models/selfie_segmenter.tflite'), true);

  const { calls, runtime } = makeRuntime();
  const service = createBackgroundSegmentationService({ moduleLoader: async () => runtime });
  await service.segmentPeople({ id: 'photo' });
  await service.segmentPeople({ id: 'photo-2' });

  assert.equal(calls.wasmRoot, MEDIAPIPE_WASM_ROOT);
  assert.deepEqual(calls.options, {
    baseOptions: { modelAssetPath: SELFIE_SEGMENTER_MODEL_URL },
    runningMode: 'IMAGE',
    outputCategoryMask: false,
    outputConfidenceMasks: true
  });
  assert.equal(calls.segments, 2);
});

test('copies the person mask and closes every MediaPipe confidence mask', async () => {
  const floatData = new Float32Array([0, 0.25, 0.75, 1]);
  const { calls, runtime } = makeRuntime({ floatData });
  const service = createBackgroundSegmentationService({ moduleLoader: async () => runtime });
  const mask = await service.segmentPeople({ id: 'photo' });

  floatData[1] = 0.9;
  assert.deepEqual(mask, {
    width: 2,
    height: 2,
    confidence: new Float32Array([0, 0.25, 0.75, 1])
  });
  assert.deepEqual(calls.closes, [1, 1]);
});

test('copies and closes a sole person confidence mask', async () => {
  const floatData = new Float32Array([0, 0.25, 0.75, 1]);
  const { calls, runtime } = makeRuntime({ floatData, confidenceMaskCount: 1 });
  const service = createBackgroundSegmentationService({ moduleLoader: async () => runtime });
  const mask = await service.segmentPeople({ id: 'photo' });

  floatData[1] = 0.9;
  assert.deepEqual(mask, {
    width: 2,
    height: 2,
    confidence: new Float32Array([0, 0.25, 0.75, 1])
  });
  assert.deepEqual(calls.closes, [1]);
});

test('a rejected old initialization cannot clear a newer initialization', async () => {
  const first = deferred();
  const second = deferred();
  const { runtime } = makeRuntime();
  const loads = [first.promise, second.promise];
  let loadCount = 0;
  const service = createBackgroundSegmentationService({
    moduleLoader: () => loads[loadCount++]
  });

  const oldRequest = service.segmentPeople({ id: 'old' });
  service.reset();
  const newRequest = service.segmentPeople({ id: 'new' });
  first.reject(new Error('old initialization failed'));
  second.resolve(runtime);

  await assert.rejects(oldRequest, /old initialization failed/);
  await newRequest;
  await service.segmentPeople({ id: 'reuse-new-initialization' });
  assert.equal(loadCount, 2);
});
