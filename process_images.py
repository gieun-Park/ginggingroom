#!/usr/bin/env python3
"""
이미지 자동 프레임 추출 스크립트 (Pillow 불필요)
macOS sips 명령어 또는 ffmpeg 사용
"""

import os
import subprocess
import sys

def crop_and_resize_with_sips(input_file, x, y, width, height, output_file):
    """
    sips를 사용하여 이미지 크롭 및 리사이징
    """
    try:
        # 먼저 크롭: -c top left width height
        subprocess.run([
            'sips',
            '-c', str(height), str(width), str(y), str(x),
            input_file,
            '-o', output_file
        ], check=True, capture_output=True)

        # 그 다음 400x500으로 리사이징
        subprocess.run([
            'sips',
            '-z', '500', '400',
            output_file
        ], check=True, capture_output=True)

        return True
    except subprocess.CalledProcessError as e:
        print(f"오류: {e}")
        return False

def extract_frames(input_file, cols, rows, output_dir, frame_name_start=1):
    """
    이미지를 그리드로 분리하여 프레임 추출
    """
    # 임시 파일로 이미지 크기 확인
    result = subprocess.run([
        'sips',
        '-g', 'pixelWidth',
        '-g', 'pixelHeight',
        input_file
    ], capture_output=True, text=True, check=True)

    # 출력에서 크기 파싱 (첫 번째 라인은 파일명이므로 스킵)
    lines = result.stdout.strip().split('\n')
    # 파일명 라인부터 시작하므로 인덱스 조정
    width_line = [l for l in lines if 'pixelWidth:' in l][0]
    height_line = [l for l in lines if 'pixelHeight:' in l][0]
    width = int(width_line.split(': ')[1])
    height = int(height_line.split(': ')[1])

    print(f"이미지: {input_file} ({width}x{height})")
    print(f"그리드: {cols}x{rows}")

    cell_width = width // cols
    cell_height = height // rows
    print(f"각 셀: {cell_width}x{cell_height}")
    print()

    frame_num = frame_name_start

    for row in range(rows):
        for col in range(cols):
            x = col * cell_width
            y = row * cell_height

            output_file = os.path.join(output_dir, f'frame-{frame_num}.png')

            # 이미지 크롭 및 리사이징
            if crop_and_resize_with_sips(input_file, x, y, cell_width, cell_height, output_file):
                print(f"✓ frame-{frame_num}.png")
                frame_num += 1
            else:
                print(f"✗ frame-{frame_num}.png 실패")

    return frame_num - frame_name_start

def extract_single_frame(input_file, output_file):
    """
    전체 이미지를 400x500으로 리사이징하여 저장
    """
    print(f"이미지: {input_file} (전체)")

    try:
        # 400x500으로 리사이징
        subprocess.run([
            'sips',
            '-z', '500', '400',
            input_file,
            '-o', output_file
        ], check=True, capture_output=True)

        print(f"✓ {output_file}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ 오류: {e}")
        return False

def main():
    # 설정
    project_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(project_dir, 'assets', 'frames')
    os.makedirs(output_dir, exist_ok=True)

    print("=" * 60)
    print("징징이 포토부스 - 프레임 자동 추출")
    print("=" * 60)
    print()

    frame_num = 1

    # Image 01: 3x4 (12개)
    print("[이미지 01] 3x4 그리드 (12개 프레임)")
    print("-" * 60)
    count = extract_frames(
        os.path.join(project_dir, 'input_image_01.jpeg'),
        cols=3, rows=4,
        output_dir=output_dir,
        frame_name_start=frame_num
    )
    frame_num += count
    print()

    # Image 02: 4x5 (20개)
    print("[이미지 02] 4x5 그리드 (20개 프레임)")
    print("-" * 60)
    count = extract_frames(
        os.path.join(project_dir, 'input_image_02.jpeg'),
        cols=4, rows=5,
        output_dir=output_dir,
        frame_name_start=frame_num
    )
    frame_num += count
    print()

    # Image 03: 전체 1개
    print("[이미지 03] 전체 (1개 프레임)")
    print("-" * 60)
    if extract_single_frame(
        os.path.join(project_dir, 'input_image_03.jpeg'),
        os.path.join(output_dir, f'frame-{frame_num}.png')
    ):
        frame_num += 1
    print()

    total_frames = frame_num - 1
    print("=" * 60)
    print(f"✨ 완료! 총 {total_frames}개 프레임 생성")
    print(f"📁 저장 위치: {output_dir}")
    print("=" * 60)
    print()

    # frames.js 업데이트
    update_frames_js(total_frames)
    print("✓ frames.js 업데이트 완료!")

def update_frames_js(total_frames):
    """
    frames.js 파일 자동 업데이트
    """
    frames_js_path = os.path.join(
        os.path.dirname(__file__),
        'js', 'frames.js'
    )

    # 새로운 FRAMES 배열 생성
    frames_code = "const FRAMES = [\n"

    for i in range(1, total_frames + 1):
        comma = ',' if i < total_frames else ''
        frames_code += f"""    {{
        id: 'frame-{i}',
        name: '프레임 {i}',
        src: 'assets/frames/frame-{i}.png',
        offsetX: 0,
        offsetY: 0,
        width: 400,
        height: 500
    }}{comma}
"""

    frames_code += "];"

    # 파일 읽기
    with open(frames_js_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 기존 FRAMES 배열 부분 찾아서 대체
    import re
    pattern = r'const FRAMES = \[[\s\S]*?\];'
    content = re.sub(pattern, frames_code, content)

    # 파일 쓰기
    with open(frames_js_path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
