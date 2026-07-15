const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const css = fs.readFileSync('css/styles.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

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

test('uses a sharper 4:5 logical canvas for the primary result preview', () => {
    assert.match(html, /<canvas id="canvas" width="600" height="750"><\/canvas>/);
    assert.match(css, /#canvas\s*{[^}]*width:\s*100%[^}]*height:\s*auto[^}]*aspect-ratio:\s*4\s*\/\s*5/s);
});

test('emphasizes and sticks the photo preview on desktop', () => {
    assert.match(css, /\.booth\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*7fr\)\s*minmax\(320px,\s*5fr\)/s);
    assert.match(css, /\.photo-section\s*{[^}]*position:\s*sticky[^}]*top:\s*20px[^}]*align-self:\s*start/s);
});

test('restores normal flow for the photo preview on single-column screens', () => {
    assert.match(css, /@media\s*\(max-width:\s*900px\)\s*{[\s\S]*?\.photo-section\s*{[^}]*position:\s*static/s);
});

test('keeps two shrinkable frame columns without horizontal overflow on phones', () => {
    assert.match(css, /@media\s*\(max-width:\s*480px\)\s*{[\s\S]*?\.frame-grid\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[^}]*overflow-x:\s*hidden/s);
});
