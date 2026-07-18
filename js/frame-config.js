function anchorFromBox([left, top, right, bottom]) {
  return {
    centerX: (left + right) / 960,
    centerY: (top + bottom) / 960,
    width: (right - left) / 480,
    height: (bottom - top) / 480
  };
}

function boundsFromBox([left, top, right, bottom]) {
  return {
    left: left / 480,
    top: top / 480,
    right: right / 480,
    bottom: bottom / 480
  };
}

const DEFINITIONS = [
  ['frame-1', '프레임 1', 'frame_01.png', [180, 184, 299, 269]],
  ['frame-2', '프레임 2', 'frame_02.png', [196, 190, 303, 293]],
  ['frame-3', '프레임 3', 'frame_03.png', [160, 212, 313, 319]],
  ['frame-4', '프레임 4', 'frame_04.png', [185, 186, 280, 271]],
  ['frame-5', '프레임 5', 'frame_05.png', [168, 197, 310, 296]],
  ['frame-6', '프레임 6', 'frame_06.png', [139, 191, 256, 305]],
  ['frame-7', '프레임 7', 'frame_07.png', [203, 213, 304, 275]],
  ['frame-8', '프레임 8', 'frame_08.png', [188, 191, 290, 290]],
  ['frame-9', '프레임 9', 'frame_09.png', [168, 238, 314, 322]],
  ['frame-10', '프레임 10', 'frame_10.png', [171, 163, 299, 269]],
  ['frame-11', '프레임 11', 'frame_11.png', [143, 222, 274, 304]],
  ['frame-12', '프레임 12', 'frame_12.png', [184, 194, 288, 276]],
  ['frame-13', '프레임 13', 'frame_13.png', [203, 190, 267, 245]],
  ['frame-14', '프레임 14', 'frame_14.png', [213, 213, 258, 255]],
  ['frame-15', '프레임 15', 'frame_15.png', [217, 195, 276, 243]],
  ['frame-16', '프레임 16', 'frame_16.png', [223, 206, 264, 254]],
  ['frame-17', '프레임 17', 'frame_17.png', [225, 218, 258, 249]],
  ['frame-18', '프레임 18', 'frame_18.png', [218, 206, 260, 246]],
  ['frame-19', '프레임 19', 'frame_19.png', [215, 208, 263, 244]],
  ['frame-20', '프레임 20', 'frame_20.png', [210, 194, 248, 231]],
  ['frame-21', '프레임 21', 'frame_21.png', [219, 179, 260, 219]],
  ['frame-22', '프레임 22', 'frame_22.png',
    [210, 178, 263, 242],
    [[213, 193, 263, 242]],
    { mobileMaskScale: 1 }],
  ['frame-23', '프레임 23', 'frame_23.png', [246, 193, 290, 236]],
  ['frame-24', '프레임 24', 'frame_24.png', [216, 243, 252, 278]],
  ['frame-25', '프레임 25', 'frame_25.png',
    [148, 222, 191, 262],
    [[148, 222, 191, 262], [290, 197, 350, 257]],
    {
      layout: {
        mode: 'paired',
        contentBounds: boundsFromBox([88, 152, 393, 328]),
        viewportPadding: 0.04,
        portraitInset: {
          sourceWidthScale: 1.35
        }
      }
    }],
  ['frame-26', '프레임 26', 'frame_26.png', [210, 178, 269, 239]]
];

export const FRAMES = DEFINITIONS.map(([
  id,
  name,
  filename,
  faceBox,
  maskBoxes = [faceBox],
  rendering = {}
]) => ({
  id,
  name,
  src: `assets/frames/${filename}`,
  faceAnchor: anchorFromBox(faceBox),
  maskAnchors: maskBoxes.map(anchorFromBox),
  fitPadding: 1.08,
  ...rendering
}));
