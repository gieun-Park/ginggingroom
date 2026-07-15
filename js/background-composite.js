import { getCoverTransform } from './face-geometry.js';

function browserCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function alphaByte(confidence) {
  return Math.round(Math.max(0, Math.min(1, confidence)) * 255);
}

export function createPersonForeground(
  photo,
  mask,
  { createCanvas = browserCanvas } = {}
) {
  const maskCanvas = createCanvas(mask.width, mask.height);
  const maskContext = maskCanvas.getContext('2d');
  const maskImage = maskContext.createImageData(mask.width, mask.height);
  for (let index = 0; index < mask.confidence.length; index += 1) {
    const pixel = index * 4;
    maskImage.data[pixel] = 255;
    maskImage.data[pixel + 1] = 255;
    maskImage.data[pixel + 2] = 255;
    maskImage.data[pixel + 3] = alphaByte(mask.confidence[index]);
  }
  maskContext.putImageData(maskImage, 0, 0);

  const foreground = createCanvas(photo.width, photo.height);
  const context = foreground.getContext('2d');
  context.drawImage(photo, 0, 0, photo.width, photo.height);
  context.globalCompositeOperation = 'destination-in';
  context.drawImage(maskCanvas, 0, 0, photo.width, photo.height);
  context.globalCompositeOperation = 'source-over';
  return foreground;
}

export function fillCanvasWhite(context, canvasSize) {
  context.clearRect(0, 0, canvasSize.width, canvasSize.height);
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvasSize.width, canvasSize.height);
}

export function drawPhotoLayer(context, source, imageSize, canvasSize) {
  const { scale, offsetX, offsetY } = getCoverTransform(imageSize, canvasSize);
  context.drawImage(
    source,
    offsetX,
    offsetY,
    imageSize.width * scale,
    imageSize.height * scale
  );
}
