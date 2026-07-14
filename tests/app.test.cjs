const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

test('선택한 프레임을 사진 없이도 캔버스에 표시한다', () => {
    const drawCalls = [];
    const loadHandlers = [];

    class Element {
        constructor(id = '') {
            this.id = id;
            this.children = [];
            this.listeners = {};
            this.classList = { add() {}, remove() {} };
            this.style = {};
        }

        appendChild(child) { this.children.push(child); }
        addEventListener(type, handler) { this.listeners[type] = handler; }
    }

    const elements = Object.fromEntries(
        ['canvas', 'photoInput', 'cameraBtn', 'frameGrid', 'resultArea',
            'resultImage', 'downloadBtn', 'resetBtn', 'video']
            .map(id => [id, new Element(id)])
    );
    elements.canvas.width = 400;
    elements.canvas.height = 500;
    elements.canvas.getContext = () => ({
        clearRect() {},
        fillRect() {},
        fillText() {},
        drawImage(...args) { drawCalls.push(args); },
        set fillStyle(value) {},
        set font(value) {},
        set textAlign(value) {}
    });

    class ImageElement extends Element {
        set src(value) {
            this._src = value;
            if (this._onload) this._onload();
        }
        get src() { return this._src; }
        set onload(handler) {
            this._onload = handler;
            if (this._src) handler();
        }
        get onload() { return this._onload; }
    }

    const context = vm.createContext({
        console,
        Image: ImageElement,
        FileReader: class {},
        navigator: {},
        document: {
            getElementById: id => elements[id] || new Element(id),
            createElement: tag => tag === 'img' ? new ImageElement() : new Element(),
            querySelectorAll: () => []
        },
        window: {
            addEventListener(type, handler) {
                if (type === 'load') loadHandlers.push(handler);
            }
        }
    });

    vm.runInContext(fs.readFileSync('js/frames.js', 'utf8'), context);
    vm.runInContext(fs.readFileSync('js/app.js', 'utf8'), context);
    loadHandlers.forEach(handler => handler());

    elements.frameGrid.children[0].listeners.click();

    assert.equal(drawCalls.length, 1);
});
