#!/usr/bin/env python3
"""
이미지에서 개별 캐릭터를 추출하는 스크립트
각 캐릭터를 400x500px로 크롭하여 frame-X.png로 저장합니다.
"""

import os
import sys
from PIL import Image
import json

def extract_frames_from_image(image_path, output_dir, cols, rows, frame_width=400, frame_height=500):
    """
    그리드 형태의 이미지에서 개별 프레임 추출

    Args:
        image_path: 입력 이미지 경로
        output_dir: 출력 폴더 경로
        cols: 열의 개수
        rows: 행의 개수
        frame_width: 프레임 너비 (픽셀)
        frame_height: 프레임 높이 (픽셀)
    """

    # 출력 폴더 생성
    os.makedirs(output_dir, exist_ok=True)

    # 이미지 열기
    img = Image.open(image_path)
    print(f"이미지 로드: {image_path}")
    print(f"이미지 크기: {img.size}")

    # 이미지 크기로부터 각 셀 크기 계산
    total_width, total_height = img.size
    cell_width = total_width // cols
    cell_height = total_height // rows

    print(f"그리드: {cols}x{rows}")
    print(f"각 셀 크기: {cell_width}x{cell_height}")

    frame_num = 1

    # 각 셀에서 프레임 추출
    for row in range(rows):
        for col in range(cols):
            # 현재 셀의 경계 계산
            left = col * cell_width
            top = row * cell_height
            right = left + cell_width
            bottom = top + cell_height

            # 이미지 크롭
            frame = img.crop((left, top, right, bottom))

            # 400x500으로 리사이징
            frame_resized = frame.resize((frame_width, frame_height), Image.Resampling.LANCZOS)

            # 파일명 생성 및 저장
            filename = f"frame-{frame_num}.png"
            filepath = os.path.join(output_dir, filename)
            frame_resized.save(filepath, 'PNG')

            print(f"✓ {filename} 저장됨 ({cell_width}x{cell_height} → {frame_width}x{frame_height})")
            frame_num += 1

    print(f"\n완료! 총 {frame_num - 1}개의 프레임 생성")
    return frame_num - 1


def main():
    """메인 함수"""

    # 기본 설정
    project_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(project_dir, 'assets', 'frames')

    print("=" * 60)
    print("징징이 포토부스 - 프레임 추출 도구")
    print("=" * 60)

    # 입력 이미지 선택
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
    else:
        # 대화형 모드
        print("\n사용 가능한 옵션:")
        print("1. 파일 경로 입력")
        print("2. 현재 폴더의 이미지 파일 목록")

        # 현재 폴더의 이미지 찾기
        image_files = [f for f in os.listdir('.') if f.lower().endswith(('.png', '.jpg', '.jpeg'))]

        if image_files:
            print(f"\n발견된 이미지 파일:")
            for i, f in enumerate(image_files, 1):
                print(f"  {i}. {f}")

            choice = input("\n이미지를 선택하세요 (숫자 또는 경로): ").strip()

            try:
                choice_num = int(choice)
                if 1 <= choice_num <= len(image_files):
                    image_path = image_files[choice_num - 1]
                else:
                    image_path = choice
            except ValueError:
                image_path = choice
        else:
            image_path = input("이미지 파일 경로를 입력하세요: ").strip()

    # 이미지 파일 존재 확인
    if not os.path.exists(image_path):
        print(f"\n오류: 파일을 찾을 수 없습니다 - {image_path}")
        sys.exit(1)

    print(f"\n선택된 이미지: {image_path}")

    # 이미지 미리보기 (크기 확인)
    img = Image.open(image_path)
    print(f"이미지 크기: {img.size[0]}x{img.size[1]}")

    # 그리드 설정
    print("\n그리드 설정 (예: 5x3 = 5개 열, 3개 행):")
    while True:
        grid_input = input("행의 개수와 열의 개수를 입력하세요 (예: 5 3): ").strip()
        try:
            parts = grid_input.split()
            cols = int(parts[0])
            rows = int(parts[1])
            if cols > 0 and rows > 0:
                break
            print("양수를 입력해주세요.")
        except (ValueError, IndexError):
            print("형식: <열의 개수> <행의 개수> (예: 5 3)")

    # 프레임 크기 설정 (기본값 400x500)
    print("\n프레임 크기 (기본값: 400 500):")
    size_input = input("너비 높이를 입력하세요 (예: 400 500) [Enter로 기본값]: ").strip()

    if size_input:
        try:
            parts = size_input.split()
            frame_width = int(parts[0])
            frame_height = int(parts[1])
        except (ValueError, IndexError):
            frame_width = 400
            frame_height = 500
            print("잘못된 입력, 기본값 사용: 400x500")
    else:
        frame_width = 400
        frame_height = 500

    print(f"\n프레임 설정: {cols}열 × {rows}행 → {frame_width}x{frame_height}px")

    # 프레임 추출
    try:
        count = extract_frames_from_image(
            image_path,
            output_dir,
            cols,
            rows,
            frame_width,
            frame_height
        )

        print(f"\n✨ {output_dir} 폴더에 저장되었습니다!")

        # frames.js 업데이트 여부 확인
        update_frames_js = input("\nframes.js를 자동으로 업데이트하시겠습니까? (y/n): ").lower()
        if update_frames_js == 'y':
            update_frames_config(count, frame_width, frame_height)
            print("✓ frames.js 업데이트 완료!")

    except Exception as e:
        print(f"\n오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def update_frames_config(frame_count, width, height):
    """frames.js 파일 업데이트"""

    frames_js_path = os.path.join(
        os.path.dirname(__file__),
        'js',
        'frames.js'
    )

    # 새로운 frames 배열 생성
    frames_array = "const FRAMES = [\n"

    for i in range(1, frame_count + 1):
        frame_name = f"프레임 {i}"
        comma = ',' if i < frame_count else ''
        newline = '\n'
        frames_array += f"""    {{
        id: 'frame-{i}',
        name: '{frame_name}',
        src: 'assets/frames/frame-{i}.png',
        offsetX: 0,
        offsetY: 0,
        width: {width},
        height: {height}
    }}{comma}{newline}{newline}"""

    frames_array += "];\n"

    # 파일 읽기
    with open(frames_js_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # const FRAMES = [ ... ]; 부분 찾아서 대체
    import re
    pattern = r'const FRAMES = \[[\s\S]*?\];'
    content = re.sub(pattern, frames_array.rstrip() + ';', content)

    # 파일 쓰기
    with open(frames_js_path, 'w', encoding='utf-8') as f:
        f.write(content)


if __name__ == '__main__':
    main()
