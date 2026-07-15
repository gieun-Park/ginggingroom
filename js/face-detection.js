import { landmarksToPlacement } from './face-geometry.js';

export const MEDIAPIPE_VERSION = '0.10.35';
export const MEDIAPIPE_MODULE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/+esm`;
export const MEDIAPIPE_WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
export const FACE_MODEL_URL = new URL('../assets/models/face_landmarker.task', import.meta.url).href;

export function createFaceDetectionService({
  moduleLoader = () => import(MEDIAPIPE_MODULE_URL),
  wasmRoot = MEDIAPIPE_WASM_ROOT,
  modelAssetPath = FACE_MODEL_URL
} = {}) {
  let detectorPromise = null;

  async function getDetector() {
    if (!detectorPromise) {
      detectorPromise = (async () => {
        const { FilesetResolver, FaceLandmarker } = await moduleLoader();
        const vision = await FilesetResolver.forVisionTasks(wasmRoot);
        return FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath },
          runningMode: 'IMAGE',
          numFaces: 10,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false
        });
      })().catch(error => {
        detectorPromise = null;
        throw error;
      });
    }
    return detectorPromise;
  }

  return {
    async detectFaces(image) {
      const detector = await getDetector();
      return detector.detect(image).faceLandmarks
        .slice(0, 10)
        .map(landmarksToPlacement)
        .filter(Boolean);
    },
    reset() {
      detectorPromise = null;
    }
  };
}
