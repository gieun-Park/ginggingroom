const FACE_MASK_EDGE_CLEANUP_PX = 1.5;

function traceAnchorPath(
  context,
  anchor,
  canvasWidth,
  canvasHeight,
  scale = 1,
  cleanup = 0
) {
  const width = anchor.width * scale * canvasWidth;
  const height = anchor.height * scale * canvasHeight;
  const centerX = anchor.centerX * canvasWidth;
  const centerY = anchor.centerY * canvasHeight;
  context.beginPath();
  if (anchor.shape === 'rect') {
    context.rect(
      centerX - width / 2 - cleanup,
      centerY - height / 2 - cleanup,
      width + cleanup * 2,
      height + cleanup * 2
    );
    return;
  }
  context.ellipse(
    centerX,
    centerY,
    width / 2 + cleanup,
    height / 2 + cleanup,
    0,
    0,
    Math.PI * 2
  );
}

export function prepareFrameImage(frameImage, frame, {
  createCanvas = () => document.createElement('canvas'),
  maskScale = 1
} = {}) {
  const canvas = createCanvas();
  const resolvedMaskScale = isFinitePositive(maskScale) ? maskScale : 1;
  canvas.width = frameImage.naturalWidth;
  canvas.height = frameImage.naturalHeight;
  const context = canvas.getContext('2d');
  context.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'destination-out';
  (frame.maskAnchors ?? []).forEach(anchor => {
    traceAnchorPath(
      context,
      anchor,
      canvas.width,
      canvas.height,
      resolvedMaskScale,
      FACE_MASK_EDGE_CLEANUP_PX
    );
    context.fill();
  });
  context.globalCompositeOperation = 'source-over';
  return canvas;
}

function isFinitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

function isValidAnchor(anchor) {
  return anchor
    && [anchor.centerX, anchor.centerY, anchor.width, anchor.height]
      .every(isFinitePositive)
    && anchor.centerX <= 1
    && anchor.centerY <= 1
    && anchor.width <= 1
    && anchor.height <= 1;
}

function isValidPlacement(placement) {
  return placement
    && Number.isFinite(placement.centerX)
    && Number.isFinite(placement.centerY)
    && isFinitePositive(placement.width)
    && isFinitePositive(placement.height);
}

function getCanvasFactory(options) {
  if (typeof options?.createCanvas === 'function') return options.createCanvas;
  if (typeof document !== 'undefined') return () => document.createElement('canvas');
  return null;
}

function createSlotLayers(context, preparedFrame, options) {
  const outputCanvas = context.canvas;
  const createCanvas = getCanvasFactory(options);
  if (
    !createCanvas
    || !outputCanvas
    || !isFinitePositive(outputCanvas.width)
    || !isFinitePositive(outputCanvas.height)
    || !isFinitePositive(preparedFrame.width)
    || !isFinitePositive(preparedFrame.height)
  ) return null;

  const snapshot = createCanvas();
  snapshot.width = outputCanvas.width;
  snapshot.height = outputCanvas.height;
  const snapshotContext = snapshot.getContext('2d');
  if (!snapshotContext) return null;
  snapshotContext.drawImage(outputCanvas, 0, 0, snapshot.width, snapshot.height);

  const portraits = createCanvas();
  portraits.width = preparedFrame.width;
  portraits.height = preparedFrame.height;
  const portraitContext = portraits.getContext('2d');
  if (!portraitContext) return null;

  return { snapshot, portraits, portraitContext };
}

function assignPlacementsToSlots(placements, slotCount) {
  if (!Number.isInteger(slotCount) || slotCount < 1) return [];
  const sortedBySize = placements
    .filter(isValidPlacement)
    .sort((a, b) => b.width * b.height - a.width * a.height);
  const primary = sortedBySize[0];
  if (!primary) return [];
  return [
    primary,
    ...sortedBySize.slice(1).sort((a, b) => a.centerX - b.centerX)
  ].slice(0, slotCount);
}

function getFaceCrop(
  placement,
  destinationAspect,
  sourceWidth,
  sourceHeight,
  padding
) {
  if (
    !isValidPlacement(placement)
    || !isFinitePositive(destinationAspect)
    || !isFinitePositive(sourceWidth)
    || !isFinitePositive(sourceHeight)
    || !isFinitePositive(padding)
  ) return null;

  let width = placement.width * padding;
  let height = placement.height * padding;
  if (width / height < destinationAspect) width = height * destinationAspect;
  else height = width / destinationAspect;

  const containScale = Math.min(1, sourceWidth / width, sourceHeight / height);
  width *= containScale;
  height *= containScale;
  return {
    left: Math.min(
      Math.max(placement.centerX - width / 2, 0),
      sourceWidth - width
    ),
    top: Math.min(
      Math.max(placement.centerY - height / 2, 0),
      sourceHeight - height
    ),
    width,
    height
  };
}

function drawPortraitAssignments(
  layer,
  preparedFrame,
  slots,
  placements,
  padding
) {
  placements.forEach((placement, index) => {
    const slot = slots[index];
    const destinationWidth = slot.width * preparedFrame.width;
    const destinationHeight = slot.height * preparedFrame.height;
    const crop = getFaceCrop(
      placement,
      destinationWidth / destinationHeight,
      layer.snapshot.width,
      layer.snapshot.height,
      padding
    );
    if (!crop) return;

    const destinationX = slot.centerX * preparedFrame.width - destinationWidth / 2;
    const destinationY = slot.centerY * preparedFrame.height - destinationHeight / 2;
    layer.portraitContext.save();
    traceAnchorPath(
      layer.portraitContext,
      slot,
      preparedFrame.width,
      preparedFrame.height
    );
    layer.portraitContext.clip();
    layer.portraitContext.drawImage(
      layer.snapshot,
      crop.left,
      crop.top,
      crop.width,
      crop.height,
      destinationX,
      destinationY,
      destinationWidth,
      destinationHeight
    );
    layer.portraitContext.restore();
  });
}

function getValidSlots(frame, mode) {
  const slots = frame.layout?.mode === mode ? frame.layout.slots : null;
  return Array.isArray(slots) && slots.length > 0 && slots.every(isValidAnchor)
    ? slots
    : null;
}

function drawAnchoredSlots(
  context,
  preparedFrame,
  frame,
  placements,
  overlayScale,
  options
) {
  const slots = getValidSlots(frame, 'anchored');
  const assignments = slots
    ? assignPlacementsToSlots(placements, slots.length)
    : [];
  if (!slots || assignments.length === 0) return false;

  const layer = createSlotLayers(context, preparedFrame, options);
  if (!layer) return false;
  drawPortraitAssignments(
    layer,
    preparedFrame,
    slots,
    assignments,
    frame.fitPadding
  );

  const primarySlot = slots[0];
  const primaryPlacement = assignments[0];
  const anchorX = primarySlot.centerX * preparedFrame.width;
  const anchorY = primarySlot.centerY * preparedFrame.height;
  const scale = Math.max(
    primaryPlacement.width * frame.fitPadding
      / (primarySlot.width * preparedFrame.width),
    primaryPlacement.height * frame.fitPadding
      / (primarySlot.height * preparedFrame.height)
  ) * overlayScale;
  if (!isFinitePositive(scale)) return false;

  context.save();
  context.translate(primaryPlacement.centerX, primaryPlacement.centerY);
  context.scale(scale, scale);
  context.drawImage(layer.portraits, -anchorX, -anchorY);
  context.drawImage(preparedFrame, -anchorX, -anchorY);
  context.restore();
  return true;
}

function drawContainedSlots(
  context,
  preparedFrame,
  frame,
  placements,
  options
) {
  const slots = getValidSlots(frame, 'contain');
  const canvas = context.canvas;
  if (
    !slots
    || !canvas
    || !isFinitePositive(canvas.width)
    || !isFinitePositive(canvas.height)
    || !isFinitePositive(preparedFrame.width)
    || !isFinitePositive(preparedFrame.height)
  ) return false;

  const layer = createSlotLayers(context, preparedFrame, options);
  if (!layer) return false;
  const assignments = assignPlacementsToSlots(placements, slots.length);
  drawPortraitAssignments(
    layer,
    preparedFrame,
    slots,
    assignments,
    frame.fitPadding
  );

  const scale = Math.min(
    canvas.width / preparedFrame.width,
    canvas.height / preparedFrame.height
  );
  if (!isFinitePositive(scale)) return false;

  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);
  context.scale(scale, scale);
  context.drawImage(
    layer.portraits,
    -preparedFrame.width / 2,
    -preparedFrame.height / 2
  );
  context.drawImage(
    preparedFrame,
    -preparedFrame.width / 2,
    -preparedFrame.height / 2
  );
  context.restore();
  return true;
}

function drawPairedFrame(context, preparedFrame, frame, placements, overlayScale) {
  const canvas = context.canvas;
  const layout = frame.layout;
  const bounds = layout?.contentBounds;
  if (
    layout?.mode !== 'paired'
    || !canvas
    || !isFinitePositive(canvas.width)
    || !isFinitePositive(canvas.height)
    || !Array.isArray(frame.maskAnchors)
    || frame.maskAnchors.length < 2
    || !bounds
    || ![bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isFinite)
    || bounds.left < 0
    || bounds.top < 0
    || bounds.right > 1
    || bounds.bottom > 1
    || bounds.left >= bounds.right
    || bounds.top >= bounds.bottom
    || !Number.isFinite(layout.viewportPadding)
    || layout.viewportPadding < 0
  ) return false;

  const placement = placements[0];
  if (!placement) return true;
  const anchor = placement.centerX < canvas.width / 2
    ? frame.maskAnchors[0]
    : frame.maskAnchors[1];
  const anchorX = anchor.centerX * preparedFrame.width;
  const anchorY = anchor.centerY * preparedFrame.height;
  const anchorWidth = anchor.width * preparedFrame.width;
  const anchorHeight = anchor.height * preparedFrame.height;
  const contentLeft = bounds.left * preparedFrame.width;
  const contentTop = bounds.top * preparedFrame.height;
  const contentRight = bounds.right * preparedFrame.width;
  const contentBottom = bounds.bottom * preparedFrame.height;
  if (
    ![anchorX, anchorY, anchorWidth, anchorHeight].every(isFinitePositive)
    || anchorX <= contentLeft
    || anchorX >= contentRight
    || anchorY <= contentTop
    || anchorY >= contentBottom
  ) return false;

  const faceFitScale = Math.max(
    placement.width * frame.fitPadding / anchorWidth,
    placement.height * frame.fitPadding / anchorHeight
  ) * overlayScale;
  const margin = Math.min(canvas.width, canvas.height) * layout.viewportPadding;
  const containScale = Math.min(
    (placement.centerX - margin) / (anchorX - contentLeft),
    (canvas.width - margin - placement.centerX) / (contentRight - anchorX),
    (placement.centerY - margin) / (anchorY - contentTop),
    (canvas.height - margin - placement.centerY) / (contentBottom - anchorY)
  );
  const scale = layout.scaleMode === 'face'
    ? faceFitScale
    : Math.min(faceFitScale, containScale);
  if (!isFinitePositive(scale)) return false;

  context.save();
  context.translate(placement.centerX, placement.centerY);
  context.scale(scale, scale);
  context.drawImage(preparedFrame, -anchorX, -anchorY);
  context.restore();
  return true;
}

export function drawFrameOverlays(
  context,
  preparedFrame,
  frame,
  placements,
  overlayScale = 1,
  options = {}
) {
  if (
    frame.layout?.mode === 'paired'
    && drawPairedFrame(context, preparedFrame, frame, placements, overlayScale)
  ) return;

  if (
    frame.layout?.mode === 'anchored'
    && drawAnchoredSlots(
      context,
      preparedFrame,
      frame,
      placements,
      overlayScale,
      options
    )
  ) return;

  if (
    frame.layout?.mode === 'contain'
    && drawContainedSlots(
      context,
      preparedFrame,
      frame,
      placements,
      options
    )
  ) return;

  const anchorX = frame.faceAnchor.centerX * preparedFrame.width;
  const anchorY = frame.faceAnchor.centerY * preparedFrame.height;
  const anchorWidth = frame.faceAnchor.width * preparedFrame.width;
  const anchorHeight = frame.faceAnchor.height * preparedFrame.height;

  placements.forEach(placement => {
    const fitScale = Math.max(
      placement.width * frame.fitPadding / anchorWidth,
      placement.height * frame.fitPadding / anchorHeight
    );
    const scale = fitScale * overlayScale;
    context.save();
    context.translate(placement.centerX, placement.centerY);
    context.rotate(placement.rotation);
    context.scale(scale, scale);
    context.drawImage(preparedFrame, -anchorX, -anchorY);
    context.restore();
  });
}
