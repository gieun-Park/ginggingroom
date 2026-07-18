export const CAMERA_ZOOM_OPTIONS = Object.freeze([0.5, 0.8, 1]);

const FLOAT_TOLERANCE = 1e-6;

function isFiniteRange(range) {
  return Number.isFinite(range?.min)
    && Number.isFinite(range?.max)
    && range.min <= range.max;
}

function isStepAligned(value, min, step) {
  if (!Number.isFinite(step) || step <= 0) return true;
  const stepCount = (value - min) / step;
  return Math.abs(stepCount - Math.round(stepCount)) <= FLOAT_TOLERANCE;
}

export function getSupportedZoomOptions(
  capabilities,
  candidates = CAMERA_ZOOM_OPTIONS
) {
  const range = capabilities?.zoom;
  if (!isFiniteRange(range)) return [];

  return candidates.filter(value => (
    Number.isFinite(value)
    && value >= range.min - FLOAT_TOLERANCE
    && value <= range.max + FLOAT_TOLERANCE
    && isStepAligned(value, range.min, range.step)
  ));
}

export async function applyCameraZoom(track, zoom) {
  if (typeof track?.applyConstraints !== 'function') {
    throw new Error('카메라 배율을 변경할 수 없어요.');
  }
  await track.applyConstraints({ advanced: [{ zoom }] });
}
