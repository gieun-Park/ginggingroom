export function prepareFrameImage(frameImage, frame, {
  createCanvas = () => document.createElement('canvas'),
  maskScale = 1
} = {}) {
  const canvas = createCanvas();
  const resolvedMaskScale = isFinitePositive(maskScale) ? maskScale : 1;
  canvas.width = frameImage.naturalWidth;
  canvas.height = frameImage.naturalHeight;
  canvas.maskScale = resolvedMaskScale;
  const context = canvas.getContext('2d');
  context.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'destination-out';
  frame.maskAnchors.forEach(anchor => {
    context.beginPath();
    context.ellipse(
      anchor.centerX * canvas.width,
      anchor.centerY * canvas.height,
      anchor.width * resolvedMaskScale * canvas.width / 2,
      anchor.height * resolvedMaskScale * canvas.height / 2,
      0,
      0,
      Math.PI * 2
    );
    context.fill();
  });
  context.globalCompositeOperation = 'source-over';
  return canvas;
}

function isFinitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

function createBrowserCanvas() {
  return typeof document === 'undefined'
    ? null
    : document.createElement('canvas');
}

function captureFacePortrait(context, placement, sourceWidthScale, createCanvas) {
  const sourceCanvas = context.canvas;
  if (
    !sourceCanvas
    || !isFinitePositive(sourceCanvas.width)
    || !isFinitePositive(sourceCanvas.height)
    || !Number.isFinite(placement?.centerX)
    || !Number.isFinite(placement?.centerY)
    || !isFinitePositive(placement?.width)
    || !isFinitePositive(sourceWidthScale)
    || typeof createCanvas !== 'function'
  ) return null;

  const cropSide = Math.min(
    placement.width * sourceWidthScale,
    sourceCanvas.width,
    sourceCanvas.height
  );
  if (!isFinitePositive(cropSide)) return null;
  const cropLeft = Math.min(
    Math.max(placement.centerX - cropSide / 2, 0),
    sourceCanvas.width - cropSide
  );
  const cropTop = Math.min(
    Math.max(placement.centerY - cropSide / 2, 0),
    sourceCanvas.height - cropSide
  );

  try {
    const portrait = createCanvas();
    if (!portrait) return null;
    portrait.width = Math.max(1, Math.round(cropSide));
    portrait.height = Math.max(1, Math.round(cropSide));
    const portraitContext = portrait.getContext?.('2d');
    if (!portraitContext) return null;
    portraitContext.drawImage(
      sourceCanvas,
      cropLeft,
      cropTop,
      cropSide,
      cropSide,
      0,
      0,
      portrait.width,
      portrait.height
    );
    return portrait;
  } catch {
    return null;
  }
}

function drawPortraitInset(
  context,
  portrait,
  placement,
  anchorWidth,
  anchorHeight,
  pairScale,
  preparedMaskScale
) {
  const targetWidth = anchorWidth * pairScale * preparedMaskScale;
  const targetHeight = anchorHeight * pairScale * preparedMaskScale;
  if (!isFinitePositive(targetWidth) || !isFinitePositive(targetHeight)) return;

  context.save();
  context.beginPath();
  context.ellipse(
    placement.centerX,
    placement.centerY,
    targetWidth / 2,
    targetHeight / 2,
    0,
    0,
    Math.PI * 2
  );
  context.clip();
  context.drawImage(
    portrait,
    placement.centerX - targetWidth / 2,
    placement.centerY - targetHeight / 2,
    targetWidth,
    targetHeight
  );
  context.restore();
}

function drawPairedFrame(
  context,
  preparedFrame,
  frame,
  placements,
  overlayScale,
  createCanvas
) {
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
  const scale = Math.min(faceFitScale, containScale);
  if (!isFinitePositive(scale)) return false;

  const portraitConfig = layout.portraitInset;
  if (isFinitePositive(portraitConfig?.sourceWidthScale)) {
    const portrait = captureFacePortrait(
      context,
      placement,
      portraitConfig.sourceWidthScale,
      createCanvas
    );
    if (portrait) {
      const preparedMaskScale = isFinitePositive(preparedFrame.maskScale)
        ? preparedFrame.maskScale
        : 1;
      drawPortraitInset(
        context,
        portrait,
        placement,
        anchorWidth,
        anchorHeight,
        scale,
        preparedMaskScale
      );
    }
  }

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
  { createCanvas = createBrowserCanvas } = {}
) {
  if (
    frame.layout?.mode === 'paired'
    && drawPairedFrame(
      context,
      preparedFrame,
      frame,
      placements,
      overlayScale,
      createCanvas
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
