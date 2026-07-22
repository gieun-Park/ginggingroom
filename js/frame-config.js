function anchorFromBox(
  [left, top, right, bottom],
  [sourceWidth, sourceHeight] = [480, 480]
) {
  return {
    centerX: (left + right) / (sourceWidth * 2),
    centerY: (top + bottom) / (sourceHeight * 2),
    width: (right - left) / sourceWidth,
    height: (bottom - top) / sourceHeight
  };
}

function boundsFromBox(
  [left, top, right, bottom],
  [sourceWidth, sourceHeight] = [480, 480]
) {
  return {
    left: left / sourceWidth,
    top: top / sourceHeight,
    right: right / sourceWidth,
    bottom: bottom / sourceHeight
  };
}

function slotsFromBoxes(boxes, sourceSize = [480, 480], shape = 'ellipse') {
  return boxes.map(box => ({ ...anchorFromBox(box, sourceSize), shape }));
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
        scaleMode: 'face'
      }
    }],
  ['frame-26', '프레임 26', 'frame_26.png', [210, 178, 269, 239]],
  ['frame-27', '프레임 27', 'frame_27.png', [138, 176, 337, 402]],
  ['frame-28', '프레임 28', 'frame_28.png',
    [193, 119, 285, 211],
    [[193, 119, 285, 211], [193, 23, 281, 105], [197, 216, 286, 307]],
    {
      layout: {
        mode: 'anchored',
        slots: slotsFromBoxes([
          [193, 119, 285, 211],
          [193, 23, 281, 105],
          [197, 216, 286, 307]
        ])
      }
    }],
  ['frame-29', '프레임 29', 'frame_29.png',
    [159, 148, 294, 245],
    [[159, 148, 294, 245], [105, 300, 199, 366], [270, 316, 355, 391]],
    {
      layout: {
        mode: 'anchored',
        slots: slotsFromBoxes([
          [159, 148, 294, 245],
          [105, 300, 199, 366],
          [270, 316, 355, 391]
        ])
      }
    }],
  ['frame-30', '프레임 30', 'frame_30.png', [85, 180, 315, 343]],
  ['frame-31', '프레임 31', 'frame_31.png', [62, 165, 418, 414]],
  ['frame-32', '프레임 32', 'frame_32.png', [117, 134, 352, 314]],
  ['frame-33', '프레임 33', 'frame_33.png',
    [198, 660, 893, 1110],
    [],
    {
      layout: {
        mode: 'contain',
        slots: slotsFromBoxes([[198, 660, 893, 1110]], [1080, 1920], 'rect')
      }
    },
    [1080, 1920]],
  ['frame-34', '프레임 34', 'frame_34.png',
    [58, 173, 157, 248],
    undefined,
    {},
    [216, 350]],
  ['frame-35', '프레임 35', 'frame_35.png',
    [37, 165, 159, 242],
    undefined,
    {},
    [204, 340]],
  ['frame-36', '프레임 36', 'frame_36.png',
    [69, 105, 170, 193],
    undefined,
    {},
    [236, 296]],
  ['frame-37', '프레임 37', 'frame_37.png',
    [46, 150, 156, 229],
    undefined,
    {},
    [217, 340]]
];

export const FRAMES = DEFINITIONS.map(([
  id,
  name,
  filename,
  faceBox,
  maskBoxes = [faceBox],
  rendering = {},
  sourceSize = [480, 480]
]) => ({
  id,
  name,
  src: `assets/frames/${filename}`,
  faceAnchor: anchorFromBox(faceBox, sourceSize),
  maskAnchors: maskBoxes.map(box => anchorFromBox(box, sourceSize)),
  fitPadding: 1.08,
  ...rendering
}));
