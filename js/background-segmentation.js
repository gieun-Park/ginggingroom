import {
  MEDIAPIPE_MODULE_URL,
  MEDIAPIPE_WASM_ROOT
} from './face-detection.js';

export const SELFIE_SEGMENTER_MODEL_URL = new URL(
  '../assets/models/selfie_segmenter.tflite',
  import.meta.url
).href;

export function createBackgroundSegmentationService({
  moduleLoader = () => import(MEDIAPIPE_MODULE_URL),
  wasmRoot = MEDIAPIPE_WASM_ROOT,
  modelAssetPath = SELFIE_SEGMENTER_MODEL_URL
} = {}) {
  let segmenterPromise = null;

  async function getSegmenter() {
    if (!segmenterPromise) {
      const initialization = (async () => {
        const { FilesetResolver, ImageSegmenter } = await moduleLoader();
        const vision = await FilesetResolver.forVisionTasks(wasmRoot);
        return ImageSegmenter.createFromOptions(vision, {
          baseOptions: { modelAssetPath },
          runningMode: 'IMAGE',
          outputCategoryMask: false,
          outputConfidenceMasks: true
        });
      })();
      segmenterPromise = initialization;
      try {
        return await initialization;
      } catch (error) {
        if (segmenterPromise === initialization) segmenterPromise = null;
        throw error;
      }
    }
    return segmenterPromise;
  }

  return {
    async segmentPeople(image) {
      const segmenter = await getSegmenter();
      const result = segmenter.segment(image);
      const confidenceMasks = result.confidenceMasks ?? [];
      try {
        const personMask = confidenceMasks[1];
        if (!personMask) throw new Error('Person confidence mask is unavailable.');
        return {
          width: personMask.width,
          height: personMask.height,
          confidence: Float32Array.from(personMask.getAsFloat32Array())
        };
      } finally {
        confidenceMasks.forEach(mask => mask.close());
        result.categoryMask?.close();
      }
    },
    reset() {
      segmenterPromise = null;
    }
  };
}
