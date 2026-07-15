import { landmarksToPlacement } from './face-geometry.js';

export const MEDIAPIPE_VERSION = '0.10.35';
export const MEDIAPIPE_MODULE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/+esm`;
export const MEDIAPIPE_WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
export const FACE_MODEL_URL = new URL('../assets/models/face_landmarker.task', import.meta.url).href;

function landmarkerOptions(runningMode, modelAssetPath) {
  return {
    baseOptions: { modelAssetPath },
    runningMode,
    numFaces: 10,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false
  };
}

function placementsFromResult(result) {
  return (result.faceLandmarks ?? []).slice(0, 10).map(landmarksToPlacement).filter(Boolean);
}

export function createFaceDetectionService({
  moduleLoader = () => import(MEDIAPIPE_MODULE_URL),
  wasmRoot = MEDIAPIPE_WASM_ROOT,
  modelAssetPath = FACE_MODEL_URL
} = {}) {
  let detectorPromise = null;

  async function getDetector() {
    if (!detectorPromise) {
      const initialization = (async () => {
        const { FilesetResolver, FaceLandmarker } = await moduleLoader();
        const vision = await FilesetResolver.forVisionTasks(wasmRoot);
        return FaceLandmarker.createFromOptions(vision, landmarkerOptions('IMAGE', modelAssetPath));
      })();
      detectorPromise = initialization;
      try {
        return await initialization;
      } catch (error) {
        if (detectorPromise === initialization) detectorPromise = null;
        throw error;
      }
    }
    return detectorPromise;
  }

  return {
    async detectFaces(image) {
      const detector = await getDetector();
      return placementsFromResult(detector.detect(image));
    },
    reset() {
      detectorPromise = null;
    }
  };
}

export function createLiveFaceDetectionService({
  moduleLoader = () => import(MEDIAPIPE_MODULE_URL),
  wasmRoot = MEDIAPIPE_WASM_ROOT,
  modelAssetPath = FACE_MODEL_URL
} = {}) {
  let detectorPromise = null;
  let inFlight = null;
  let latestFaces = [];

  async function getDetector() {
    if (!detectorPromise) {
      const initialization = (async () => {
        const { FilesetResolver, FaceLandmarker } = await moduleLoader();
        const vision = await FilesetResolver.forVisionTasks(wasmRoot);
        return FaceLandmarker.createFromOptions(vision, landmarkerOptions('VIDEO', modelAssetPath));
      })();
      detectorPromise = initialization;
      try {
        return await initialization;
      } catch (error) {
        if (detectorPromise === initialization) detectorPromise = null;
        throw error;
      }
    }
    return detectorPromise;
  }

  return {
    async detectFacesForVideo(video, timestamp) {
      if (inFlight) return latestFaces;
      const detection = (async () => {
        const detector = await getDetector();
        latestFaces = placementsFromResult(await detector.detectForVideo(video, timestamp));
        return latestFaces;
      })();
      inFlight = detection;
      try {
        return await detection;
      } finally {
        if (inFlight === detection) inFlight = null;
      }
    },
    reset() {
      detectorPromise = null;
      inFlight = null;
      latestFaces = [];
    }
  };
}
