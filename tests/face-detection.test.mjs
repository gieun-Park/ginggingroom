import assert from 'node:assert/strict';
import test from 'node:test';
import { FACE_OVAL_INDICES } from '../js/face-geometry.js';
import {
  FACE_MODEL_URL,
  MEDIAPIPE_MODULE_URL,
  MEDIAPIPE_VERSION,
  MEDIAPIPE_WASM_ROOT,
  createFaceDetectionService,
  createLiveFaceDetectionService
} from '../js/face-detection.js';

function validLandmarks() {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  FACE_OVAL_INDICES.forEach((index, i) => {
    const angle = Math.PI * 2 * i / FACE_OVAL_INDICES.length;
    landmarks[index] = { x: 0.5 + Math.cos(angle) * 0.2, y: 0.5 + Math.sin(angle) * 0.3 };
  });
  landmarks[33] = { x: 0.4, y: 0.4 };
  landmarks[263] = { x: 0.6, y: 0.4 };
  return landmarks;
}

test('initializes MediaPipe once with the ten-face limit and reuses it', async () => {
  const calls = [];
  const detector = { detect: () => ({ faceLandmarks: [validLandmarks()] }) };
  const moduleLoader = async () => ({
    FilesetResolver: { forVisionTasks: async root => { calls.push(['wasm', root]); return 'vision'; } },
    FaceLandmarker: {
      createFromOptions: async (vision, options) => {
        calls.push(['create', vision, options]);
        return detector;
      }
    }
  });
  const service = createFaceDetectionService({ moduleLoader, wasmRoot: '/wasm', modelAssetPath: '/model.task' });
  assert.equal((await service.detectFaces({})).length, 1);
  assert.equal((await service.detectFaces({})).length, 1);
  assert.equal(calls.filter(([name]) => name === 'create').length, 1);
  assert.deepEqual(calls.find(([name]) => name === 'create'), [
    'create',
    'vision',
    {
      baseOptions: { modelAssetPath: '/model.task' },
      runningMode: 'IMAGE',
      numFaces: 10,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: false
    }
  ]);
});

test('pins the MediaPipe runtime, WASM, and local model URLs', () => {
  assert.equal(MEDIAPIPE_VERSION, '0.10.35');
  assert.equal(MEDIAPIPE_MODULE_URL, 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/+esm');
  assert.equal(MEDIAPIPE_WASM_ROOT, 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm');
  const moduleUrl = new URL('../js/face-detection.js', import.meta.url);
  assert.equal(FACE_MODEL_URL, new URL('../assets/models/face_landmarker.task', moduleUrl).href);
});

test('filters invalid landmark sets from detection results', async () => {
  const invalidLandmarks = validLandmarks();
  invalidLandmarks[FACE_OVAL_INDICES[0]] = { x: Number.NaN, y: 0.5 };
  const moduleLoader = async () => ({
    FilesetResolver: { forVisionTasks: async () => 'vision' },
    FaceLandmarker: {
      createFromOptions: async () => ({
        detect: () => ({ faceLandmarks: [invalidLandmarks, validLandmarks()] })
      })
    }
  });
  const service = createFaceDetectionService({ moduleLoader });

  const placements = await service.detectFaces({});

  assert.equal(placements.length, 1);
  assert.ok(placements.every(placement => Number.isFinite(placement.centerX)));
});

test('caps returned placements at ten even if a detector returns more', async () => {
  const moduleLoader = async () => ({
    FilesetResolver: { forVisionTasks: async () => 'vision' },
    FaceLandmarker: {
      createFromOptions: async () => ({
        detect: () => ({ faceLandmarks: Array.from({ length: 11 }, validLandmarks) })
      })
    }
  });
  const service = createFaceDetectionService({ moduleLoader });

  assert.equal((await service.detectFaces({})).length, 10);
});

test('clears a failed initialization so retry can succeed', async () => {
  let attempts = 0;
  const moduleLoader = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('load failed');
    return {
      FilesetResolver: { forVisionTasks: async () => 'vision' },
      FaceLandmarker: { createFromOptions: async () => ({ detect: () => ({ faceLandmarks: [] }) }) }
    };
  };
  const service = createFaceDetectionService({ moduleLoader, wasmRoot: '/wasm', modelAssetPath: '/model.task' });
  await assert.rejects(service.detectFaces({}), /load failed/);
  assert.deepEqual(await service.detectFaces({}), []);
  assert.equal(attempts, 2);
});

test('an old initialization failure cannot clear a newer cached detector after reset', async () => {
  const attempts = [];
  const moduleLoader = () => new Promise((resolve, reject) => attempts.push({ resolve, reject }));
  const moduleValue = {
    FilesetResolver: { forVisionTasks: async () => 'vision' },
    FaceLandmarker: {
      createFromOptions: async () => ({ detect: () => ({ faceLandmarks: [] }) })
    }
  };
  const service = createFaceDetectionService({ moduleLoader });

  const oldDetection = service.detectFaces({ id: 'old' });
  service.reset();
  const newDetection = service.detectFaces({ id: 'new' });
  assert.equal(attempts.length, 2);

  attempts[0].reject(new Error('old load failed'));
  await assert.rejects(oldDetection, /old load failed/);
  attempts[1].resolve(moduleValue);
  assert.deepEqual(await newDetection, []);

  const cachedDetection = service.detectFaces({ id: 'cached' });
  assert.equal(attempts.length, 2);
  assert.deepEqual(await cachedDetection, []);
});

test('creates a VIDEO landmarker and converts detectForVideo results', async () => {
  const optionsSeen = [];
  const moduleLoader = async () => ({
    FilesetResolver: { forVisionTasks: async () => 'vision' },
    FaceLandmarker: {
      createFromOptions: async (vision, options) => {
        optionsSeen.push(options);
        return { detectForVideo: () => ({ faceLandmarks: [validLandmarks()] }) };
      }
    }
  });
  const service = createLiveFaceDetectionService({ moduleLoader, wasmRoot: '/wasm', modelAssetPath: '/model' });
  assert.equal((await service.detectFacesForVideo({}, 123)).length, 1);
  assert.equal(optionsSeen[0].runningMode, 'VIDEO');
  assert.equal(optionsSeen[0].numFaces, 10);
});

test('does not overlap video inference', async () => {
  let resolveDetection;
  let markStarted;
  const started = new Promise(resolve => { markStarted = resolve; });
  let calls = 0;
  const moduleLoader = async () => ({
    FilesetResolver: { forVisionTasks: async () => 'vision' },
    FaceLandmarker: {
      createFromOptions: async () => ({
        detectForVideo() {
          calls += 1;
          markStarted();
          return new Promise(resolve => { resolveDetection = resolve; });
        }
      })
    }
  });
  const service = createLiveFaceDetectionService({ moduleLoader });
  const first = service.detectFacesForVideo({}, 100);
  await started;
  assert.deepEqual(await service.detectFacesForVideo({}, 101), []);
  assert.equal(calls, 1);
  resolveDetection({ faceLandmarks: [validLandmarks()] });
  assert.equal((await first).length, 1);
});
