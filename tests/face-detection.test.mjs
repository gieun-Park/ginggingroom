import assert from 'node:assert/strict';
import test from 'node:test';
import { FACE_OVAL_INDICES } from '../js/face-geometry.js';
import { createFaceDetectionService } from '../js/face-detection.js';

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
  assert.equal(calls.find(([name]) => name === 'create')[2].numFaces, 10);
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
