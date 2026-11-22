import test from 'node:test';
import assert from 'node:assert/strict';
import { cropDocumentToSelection } from '../src/core/crop.js';

function fakeCanvas(width, height, pixels = null) {
  return {
    width, height, drawArgs: null,
    getContext() {
      return {
        getImageData: (_x, y = 0, readWidth = width) => ({
          data: pixels ? pixels.slice(y * width * 4, y * width * 4 + readWidth * 4)
            : new Uint8ClampedArray(readWidth * 4)
        }),
        drawImage: (...args) => { this.drawArgs = args; }
      };
    }
  };
}

function withCanvasDocument(run) {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => fakeCanvas(1, 1) };
  try { run(); }
  finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

test('crop to selection preserves raster, mask, text and alpha-channel alignment', () => withCanvasDocument(() => {
  const selection = new Uint8ClampedArray(5 * 4 * 4);
  selection[(1 * 5 + 2) * 4 + 3] = 255;
  selection[(2 * 5 + 3) * 4 + 3] = 255;
  const layer = { type: 'raster', canvas: fakeCanvas(5, 4), mask: fakeCanvas(5, 4), x: 0, y: 0 };
  const text = { type: 'text', x: 4, y: 3 };
  const channel = { canvas: fakeCanvas(5, 4) };
  const doc = { width: 5, height: 4, layers: [layer, text], channels: [channel] };
  const mask = fakeCanvas(5, 4, selection);

  assert.deepEqual(cropDocumentToSelection(doc, mask, { dryRun: true }), {
    cropped: true, left: 2, top: 1, width: 2, height: 2
  });
  assert.equal(doc.width, 5);
  assert.equal(cropDocumentToSelection(doc, mask).cropped, true);
  assert.deepEqual([doc.width, doc.height, layer.canvas.width, layer.canvas.height, layer.x, layer.y], [2, 2, 2, 2, 0, 0]);
  assert.deepEqual([layer.mask.width, layer.mask.height, text.x, text.y, channel.canvas.width, channel.canvas.height], [2, 2, 2, 2, 2, 2]);
  assert.deepEqual(layer.canvas.drawArgs.slice(1, 5), [2, 1, 2, 2]);
}));

test('crop to selection refuses transformed content without changing the document', () => withCanvasDocument(() => {
  const selection = new Uint8ClampedArray(2 * 2 * 4);
  selection[3] = 255;
  const layer = { type: 'raster', canvas: fakeCanvas(2, 2), x: 0, y: 0, rotation: 12 };
  const doc = { width: 2, height: 2, layers: [layer], channels: [] };
  const result = cropDocumentToSelection(doc, fakeCanvas(2, 2, selection));
  assert.deepEqual(result, { cropped: false, reason: 'transformed' });
  assert.equal(doc.width, 2);
  assert.equal(layer.canvas.width, 2);
}));
