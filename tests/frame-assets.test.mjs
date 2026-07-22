import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { inflateSync } from 'node:zlib';

function paeth(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  if (upDistance <= upperLeftDistance) return up;
  return upperLeft;
}

function decodeRgbaPng(path) {
  const file = fs.readFileSync(path);
  assert.deepEqual(
    [...file.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    `${path} signature`
  );
  let offset = 8;
  let header;
  const imageData = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const data = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12]
      };
    }
    if (type === 'IDAT') imageData.push(data);
    offset += length + 12;
    if (type === 'IEND') break;
  }
  assert.ok(header, `${path} IHDR`);
  assert.equal(header.bitDepth, 8, `${path} bit depth`);
  assert.equal(header.colorType, 6, `${path} RGBA color type`);
  assert.equal(header.interlace, 0, `${path} interlace`);

  const bytesPerPixel = 4;
  const stride = header.width * bytesPerPixel;
  const encoded = inflateSync(Buffer.concat(imageData));
  const pixels = Buffer.alloc(stride * header.height);
  let previous = Buffer.alloc(stride);
  let sourceOffset = 0;
  for (let y = 0; y < header.height; y += 1) {
    const filter = encoded[sourceOffset];
    sourceOffset += 1;
    const row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const raw = encoded[sourceOffset + x];
      const left = x >= bytesPerPixel ? row[x - bytesPerPixel] : 0;
      const up = previous[x];
      const upperLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      const predictors = [
        0,
        left,
        up,
        Math.floor((left + up) / 2),
        paeth(left, up, upperLeft)
      ];
      assert.ok(filter >= 0 && filter < predictors.length, `${path} filter ${filter}`);
      row[x] = (raw + predictors[filter]) & 0xff;
    }
    row.copy(pixels, y * stride);
    previous = row;
    sourceOffset += stride;
  }

  return {
    width: header.width,
    height: header.height,
    rgbaAt(x, y) {
      const offset = (y * header.width + x) * bytesPerPixel;
      return [...pixels.subarray(offset, offset + bytesPerPixel)];
    },
    alphaAt(x, y) {
      return pixels[(y * header.width + x) * bytesPerPixel + 3];
    }
  };
}

const FRAME_ASSETS = [
  { id: 38, size: [225, 270], face: [108, 128], art: [112, 50] },
  { id: 39, size: [206, 274], face: [93, 144], art: [103, 50] },
  { id: 40, size: [263, 279], face: [138, 160], art: [130, 70] },
  { id: 41, size: [256, 278], face: [124, 139], art: [130, 50] },
  { id: 42, size: [242, 276], face: [114, 123], art: [120, 40] },
  { id: 43, size: [249, 287], face: [121, 124], art: [50, 50] },
  { id: 44, size: [250, 337], face: [140, 180], art: [70, 70] },
  { id: 45, size: [223, 316], face: [106, 148], art: [112, 80] },
  { id: 46, size: [238, 275], face: [114, 116], art: [70, 50] },
  { id: 47, size: [273, 275], face: [140, 126], art: [135, 60] },
  { id: 48, size: [293, 282], face: [148, 137], art: [146, 60] },
  { id: 49, size: [242, 270], face: [122, 126], art: [121, 60] }
];

test('ships cleaned RGBA assets for frames 38 through 49', () => {
  FRAME_ASSETS.forEach(({ id, size, face, art }) => {
    const png = decodeRgbaPng(`assets/frames/frame_${id}.png`);
    assert.deepEqual([png.width, png.height], size, `frame-${id} size`);
    assert.deepEqual(png.rgbaAt(0, 0), [0, 0, 0, 0], `frame-${id} exterior`);
    assert.deepEqual(
      png.rgbaAt(...face),
      [0, 0, 0, 0],
      `frame-${id} face opening`
    );
    assert.equal(png.alphaAt(...art), 255, `frame-${id} artwork`);
  });
});

test('preserves the neutral panda hood in frame 43', () => {
  const png = decodeRgbaPng('assets/frames/frame_43.png');
  assert.equal(png.alphaAt(80, 70), 255);
});
