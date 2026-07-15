export function prepareFrameImage(frameImage, frame, createCanvas = () => document.createElement('canvas')) {
  const canvas = createCanvas();
  canvas.width = frameImage.naturalWidth;
  canvas.height = frameImage.naturalHeight;
  const context = canvas.getContext('2d');
  context.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'destination-out';
  frame.maskAnchors.forEach(anchor => {
    context.beginPath();
    context.ellipse(
      anchor.centerX * canvas.width,
      anchor.centerY * canvas.height,
      anchor.width * canvas.width / 2,
      anchor.height * canvas.height / 2,
      0,
      0,
      Math.PI * 2
    );
    context.fill();
  });
  context.globalCompositeOperation = 'source-over';
  return canvas;
}

export function drawFrameOverlays(context, preparedFrame, frame, placements) {
  const anchorX = frame.faceAnchor.centerX * preparedFrame.width;
  const anchorY = frame.faceAnchor.centerY * preparedFrame.height;
  const anchorWidth = frame.faceAnchor.width * preparedFrame.width;
  const anchorHeight = frame.faceAnchor.height * preparedFrame.height;

  placements.forEach(placement => {
    const scale = Math.max(
      placement.width * frame.fitPadding / anchorWidth,
      placement.height * frame.fitPadding / anchorHeight
    );
    context.save();
    context.translate(placement.centerX, placement.centerY);
    context.rotate(placement.rotation);
    context.scale(scale, scale);
    context.drawImage(preparedFrame, -anchorX, -anchorY);
    context.restore();
  });
}
