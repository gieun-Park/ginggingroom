#!/bin/bash
# 이미지를 그리드 형태로 분리하는 스크립트
# ImageMagick의 convert 명령어 사용

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$PROJECT_DIR/assets/frames"
mkdir -p "$OUTPUT_DIR"

echo "=================================="
echo "징징이 포토부스 - 프레임 추출"
echo "=================================="
echo ""

# 1. 이미지 파일 선택
if [ -z "$1" ]; then
    echo "사용 가능한 이미지 파일:"
    ls -1 *.{png,jpg,jpeg} 2>/dev/null || echo "이미지 파일을 찾을 수 없습니다."
    echo ""
    read -p "이미지 파일 경로를 입력하세요: " IMAGE_FILE
else
    IMAGE_FILE="$1"
fi

if [ ! -f "$IMAGE_FILE" ]; then
    echo "오류: 파일을 찾을 수 없습니다 - $IMAGE_FILE"
    exit 1
fi

echo "✓ 이미지 파일: $IMAGE_FILE"

# 2. 이미지 정보 확인
IMAGE_INFO=$(identify "$IMAGE_FILE" 2>/dev/null)
echo "이미지 정보: $IMAGE_INFO"
echo ""

# 3. 그리드 설정
read -p "열의 개수를 입력하세요 (예: 5): " COLS
read -p "행의 개수를 입력하세요 (예: 3): " ROWS
read -p "프레임 너비 (기본값: 400): " FRAME_WIDTH
FRAME_WIDTH=${FRAME_WIDTH:-400}
read -p "프레임 높이 (기본값: 500): " FRAME_HEIGHT
FRAME_HEIGHT=${FRAME_HEIGHT:-500}

echo ""
echo "설정: ${COLS}x${ROWS} 그리드 → ${FRAME_WIDTH}x${FRAME_HEIGHT}px"
echo ""

# 4. 그리드 분리
# ImageMagick의 crop을 사용하여 각 셀 추출
IDENTIFY_OUTPUT=$(identify -format "%wx%h" "$IMAGE_FILE")
TOTAL_WIDTH="${IDENTIFY_OUTPUT%x*}"
TOTAL_HEIGHT="${IDENTIFY_OUTPUT#*x}"

CELL_WIDTH=$((TOTAL_WIDTH / COLS))
CELL_HEIGHT=$((TOTAL_HEIGHT / ROWS))

echo "각 셀 크기: ${CELL_WIDTH}x${CELL_HEIGHT}"
echo ""

FRAME_NUM=1

for ((row=0; row<ROWS; row++)); do
    for ((col=0; col<COLS; col++)); do
        X=$((col * CELL_WIDTH))
        Y=$((row * CELL_HEIGHT))

        # crop: WIDTHxHEIGHT+X+Y
        CROP_SPEC="${CELL_WIDTH}x${CELL_HEIGHT}+${X}+${Y}"
        OUTPUT_FILE="$OUTPUT_DIR/frame-${FRAME_NUM}.png"

        # 이미지 크롭 및 리사이징
        convert "$IMAGE_FILE" \
            -crop "$CROP_SPEC" +repage \
            -resize "${FRAME_WIDTH}x${FRAME_HEIGHT}!" \
            "$OUTPUT_FILE"

        echo "✓ frame-${FRAME_NUM}.png 저장됨"
        ((FRAME_NUM++))
    done
done

echo ""
echo "✨ 완료! 총 $((FRAME_NUM - 1))개의 프레임이 생성되었습니다"
echo "📁 저장 위치: $OUTPUT_DIR"
echo ""

# 5. frames.js 업데이트 여부 확인
read -p "frames.js를 자동으로 업데이트하시겠습니까? (y/n): " UPDATE_JS

if [ "$UPDATE_JS" = "y" ] || [ "$UPDATE_JS" = "Y" ]; then
    echo "frames.js 업데이트 중..."

    # JavaScript 코드 생성
    FRAMES_CODE="const FRAMES = ["
    for ((i=1; i<FRAME_NUM; i++)); do
        FRAMES_CODE+=$'\n    {'
        FRAMES_CODE+=$'\n        id: '\''frame-'$i'\''\'','
        FRAMES_CODE+=$'\n        name: '\''프레임 '$i'\''\'','
        FRAMES_CODE+=$'\n        src: '\''assets/frames/frame-'$i'.png'\''\'','
        FRAMES_CODE+=$'\n        offsetX: 0,'
        FRAMES_CODE+=$'\n        offsetY: 0,'
        FRAMES_CODE+=$'\n        width: '$FRAME_WIDTH','
        FRAMES_CODE+=$'\n        height: '$FRAME_HEIGHT

        if [ $i -lt $((FRAME_NUM - 1)) ]; then
            FRAMES_CODE+=$'\n    },'
        else
            FRAMES_CODE+=$'\n    }'
        fi
    done
    FRAMES_CODE+=$'\n];\n'

    # frames.js 파일 업데이트
    FRAMES_JS="$PROJECT_DIR/js/frames.js"
    if [ -f "$FRAMES_JS" ]; then
        # 백업 생성
        cp "$FRAMES_JS" "$FRAMES_JS.bak"

        # Python을 사용하여 정규식으로 치환
        python3 << 'PYTHON_SCRIPT'
import re
import sys

frames_js_path = "$FRAMES_JS"
new_frames = """$FRAMES_CODE"""

try:
    with open(frames_js_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # const FRAMES = [ ... ]; 부분 찾아서 대체
    pattern = r'const FRAMES = \[[\s\S]*?\];'
    content = re.sub(pattern, new_frames.rstrip(), content)

    with open(frames_js_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print("✓ frames.js 업데이트 완료!")
except Exception as e:
    print(f"오류: {e}")
    sys.exit(1)
PYTHON_SCRIPT
    fi
fi

echo ""
echo "🎉 모든 작업이 완료되었습니다!"
