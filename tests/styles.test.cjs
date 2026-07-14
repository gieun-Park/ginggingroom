const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const css = fs.readFileSync('css/styles.css', 'utf8');

test('프레임 그리드 열이 이미지의 원본 너비보다 작게 축소될 수 있다', () => {
    assert.match(css, /\.frame-grid\s*{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
    assert.match(css, /\.frame-item\s*{[^}]*min-width:\s*0/s);
});

test('좁은 화면에서는 프레임 섹션을 한 열로 표시한다', () => {
    assert.match(css, /@media\s*\(max-width:\s*900px\)\s*{[\s\S]*?\.booth\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test('스크롤되는 프레임 그리드는 카드 높이만큼 각 행을 확보한다', () => {
    assert.match(css, /\.frame-grid\s*{[^}]*grid-auto-rows:\s*max-content/s);
    assert.match(css, /\.frame-grid\s*{[^}]*align-content:\s*start/s);
});
