import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, estimateCanvasMemory, formatBytes } from '../src/core/document.js';
import { cropCanvasToAlpha } from '../src/io/project.js';

function fakeCanvas(width, height, pixels = null) {
  return {
    width, height,
    getContext() {
      return {
        getImageData: () => ({ data: pixels || new Uint8ClampedArray(width * height * 4) }),
        drawImage() {}
      };
    }
  };
}

test('memory estimate scales by pixel count and raster-layer count', () => {
  assert.equal(estimateCanvasMemory(100, 50), 20_000);
  assert.equal(estimateCanvasMemory(100, 50, 3), 60_000);
  assert.equal(formatBytes(1024 * 1024), '1.0 MB');
});

test('new documents are no longer rejected by the former 40MP artificial cap', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => fakeCanvas(1, 1) };
  try {
    const doc = createDocument(7000, 7000, 'Grande', 'transparent');
    assert.equal(doc.width * doc.height, 49_000_000);
    assert.equal(doc.layers.length, 1);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});

test('alpha crop finds minimal visible bounds and keeps empty canvases unchanged', () => {
  const pixels = new Uint8ClampedArray(5 * 4 * 4);
  pixels[(1 * 5 + 2) * 4 + 3] = 255;
  pixels[(2 * 5 + 3) * 4 + 3] = 255;
  const previous = globalThis.document;
  globalThis.document = { createElement: () => fakeCanvas(1, 1) };
  try {
    const result = cropCanvasToAlpha(fakeCanvas(5, 4, pixels));
    assert.deepEqual([result.left, result.top, result.canvas.width, result.canvas.height, result.cropped], [2, 1, 2, 2, true]);
    const empty = fakeCanvas(5, 4);
    const unchanged = cropCanvasToAlpha(empty);
    assert.equal(unchanged.canvas, empty);
    assert.equal(unchanged.cropped, false);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});
