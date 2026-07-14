export const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
];

const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_OUTER = 263;

export function landmarksToPlacement(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length <= RIGHT_EYE_OUTER) return null;
  const oval = FACE_OVAL_INDICES.map(index => landmarks[index]);
  if (oval.some(point => !Number.isFinite(point?.x) || !Number.isFinite(point?.y))) return null;
  const leftEye = landmarks[LEFT_EYE_OUTER];
  const rightEye = landmarks[RIGHT_EYE_OUTER];
  if (![leftEye, rightEye].every(point => Number.isFinite(point?.x) && Number.isFinite(point?.y))) return null;

  const xs = oval.map(point => point.x);
  const ys = oval.map(point => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);

  return {
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    width: right - left,
    height: bottom - top,
    rotation: Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x)
  };
}

export function getCoverTransform(imageSize, canvasSize) {
  const scale = Math.max(canvasSize.width / imageSize.width, canvasSize.height / imageSize.height);
  return {
    scale,
    offsetX: (canvasSize.width - imageSize.width * scale) / 2,
    offsetY: (canvasSize.height - imageSize.height * scale) / 2
  };
}

export function mapPlacementToCanvas(placement, imageSize, canvasSize) {
  const transform = getCoverTransform(imageSize, canvasSize);
  return {
    centerX: placement.centerX * imageSize.width * transform.scale + transform.offsetX,
    centerY: placement.centerY * imageSize.height * transform.scale + transform.offsetY,
    width: placement.width * imageSize.width * transform.scale,
    height: placement.height * imageSize.height * transform.scale,
    rotation: placement.rotation
  };
}

export function isPlacementVisible(placement, canvasSize) {
  return placement.centerX >= 0 && placement.centerX <= canvasSize.width &&
    placement.centerY >= 0 && placement.centerY <= canvasSize.height;
}

export function sortPlacementsForDrawing(placements) {
  return [...placements].sort((a, b) => b.width * b.height - a.width * a.height);
}
