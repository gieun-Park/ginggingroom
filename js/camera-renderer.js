import {
  getCoverTransform,
  isPlacementVisible,
  mapPlacementToCanvas,
  sortPlacementsForDrawing
} from './face-geometry.js';
import { drawFrameOverlays } from './frame-overlay.js';

export function drawSourceCover(context, source, sourceSize, canvasSize) {
  const transform = getCoverTransform(sourceSize, canvasSize);
  context.drawImage(
    source,
    transform.offsetX,
    transform.offsetY,
    sourceSize.width * transform.scale,
    sourceSize.height * transform.scale
  );
}

export function drawMirroredSourceCover(context, source, sourceSize, canvasSize) {
  context.save();
  context.translate(canvasSize.width, 0);
  context.scale(-1, 1);
  drawSourceCover(context, source, sourceSize, canvasSize);
  context.restore();
}

export function mapMirroredPlacementToCanvas(placement, sourceSize, canvasSize) {
  const mapped = mapPlacementToCanvas(placement, sourceSize, canvasSize);
  return { ...mapped, centerX: canvasSize.width - mapped.centerX, rotation: -mapped.rotation };
}

export function drawLiveComposition({
  context,
  source,
  sourceSize,
  canvasSize,
  faces = [],
  preparedFrame = null,
  frame = null,
  overlayScale = 1,
  overlayDrawer = drawFrameOverlays
}) {
  context.clearRect(0, 0, canvasSize.width, canvasSize.height);
  drawMirroredSourceCover(context, source, sourceSize, canvasSize);
  if (!preparedFrame || !frame) return;
  const placements = sortPlacementsForDrawing(
    faces
      .map(face => mapMirroredPlacementToCanvas(face, sourceSize, canvasSize))
      .filter(face => isPlacementVisible(face, canvasSize))
  );
  overlayDrawer(context, preparedFrame, frame, placements, overlayScale);
}
