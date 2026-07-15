import { FRAMES } from './frame-config.js';

export { FRAMES };
export const loadedFrames = new Map();

export function preloadFrames(onFrameLoad = () => {}) {
    FRAMES.forEach(frame => {
        const image = new Image();
        image.onload = () => {
            loadedFrames.set(frame.id, image);
            onFrameLoad(frame.id);
        };
        image.onerror = () => console.warn(`Failed to load frame: ${frame.src}`);
        image.src = frame.src;
    });
}
