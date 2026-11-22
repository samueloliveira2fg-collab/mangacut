import test from 'node:test';
import assert from 'node:assert/strict';
import { History } from '../src/core/history.js';
import { cloneDocument } from '../src/core/document.js';

test('history stores and restores document metadata', () => {
  const history = new History(3);
  const doc = { id: 'doc-1', name: 'Original', width: 10, height: 10, colorMode: 'RGB', bitDepth: 8, activeId: 'g1', createdAt: '', layers: [{ id: 'g1', type: 'group', name: 'Grupo', visible: true, opacity: 1, blend: 'source-over', parentId: null, locked: false, expanded: true }] };
  history.checkpoint(doc, 'before rename');
  doc.name = 'Renamed';
  const restored = history.undo(doc);
  assert.equal(restored.name, 'Original');
  const redone = history.redo(restored);
  assert.equal(redone.name, 'Renamed');
});

test('history caps checkpoints and clears redo on new edit', () => {
  const history = new History(2);
  const doc = name => ({ id: 'd', name, width: 1, height: 1, colorMode: 'RGB', bitDepth: 8, activeId: null, createdAt: '', layers: [] });
  history.checkpoint(doc('one'));
  history.checkpoint(doc('two'));
  history.checkpoint(doc('three'));
  assert.equal(history.undoStack.length, 2);
  history.undo(doc('four'));
  history.checkpoint(doc('new branch'));
  assert.equal(history.redoStack.length, 0);
});

test('history undoes and redoes a paint stroke using only touched tile pixels', () => {
  class TestImageData {
    constructor(data, width, height) { this.data = data; this.width = width; this.height = height; }
  }
  const previous = globalThis.ImageData;
  globalThis.ImageData = TestImageData;
  try {
    const pixels = new Uint8ClampedArray(2 * 2 * 4);
    const ctx = {
      getImageData(x, y, width, height) {
        const data = new Uint8ClampedArray(width * height * 4);
        for (let row = 0; row < height; row++) {
          const start = ((y + row) * 2 + x) * 4;
          data.set(pixels.subarray(start, start + width * 4), row * width * 4);
        }
        return { data };
      },
      putImageData(image, x, y) {
        for (let row = 0; row < image.height; row++) {
          const start = ((y + row) * 2 + x) * 4;
          pixels.set(image.data.subarray(row * image.width * 4, (row + 1) * image.width * 4), start);
        }
      }
    };
    const canvas = { width: 2, height: 2, getContext: () => ctx };
    const doc = { id: 'd', name: 'Paint', width: 2, height: 2, colorMode: 'RGB', bitDepth: 8, activeId: 'l', createdAt: '', layers: [{ id: 'l', type: 'raster', canvas, mask: null }] };
    const before = new Uint8ClampedArray(ctx.getImageData(0, 0, 2, 2).data);
    pixels.set([255, 10, 20, 255], 0);
    const history = new History(6);
    assert.equal(history.recordTileStroke(doc, 'l', 'canvas', [{ x: 0, y: 0, width: 2, height: 2, before }], 'Pincel'), true);
    assert.equal(history.undo(doc), doc);
    assert.deepEqual([...pixels], [...before]);
    assert.equal(history.redo(doc), doc);
    assert.deepEqual([...pixels.slice(0, 4)], [255, 10, 20, 255]);
  } finally {
    if (previous === undefined) delete globalThis.ImageData;
    else globalThis.ImageData = previous;
  }
});


test('history snapshots retain document metadata and guide settings through undo/redo', () => {
  const history = new History(3);
  const doc = { id: 'meta-doc', name: 'Antes', width: 10, height: 10, colorMode: 'RGB', bitDepth: 8,
    activeId: null, createdAt: '', layers: [], channels: [],
    metadata: { source: 'scan', tags: ['ink'] }, guides: [{ axis: 'x', position: 20 }],
    grid: { enabled: true, size: 8 }, colorProfile: 'sRGB IEC61966-2.1' };
  const copy = cloneDocument(doc);
  assert.deepEqual(copy.metadata, doc.metadata);
  assert.deepEqual(copy.guides, doc.guides);
  history.checkpoint(doc);
  doc.metadata.tags.push('edited'); doc.guides[0].position = 99;
  const restored = history.undo(doc);
  assert.deepEqual(restored.metadata, { source: 'scan', tags: ['ink'] });
  assert.deepEqual(restored.guides, [{ axis: 'x', position: 20 }]);
  assert.equal(restored.colorProfile, 'sRGB IEC61966-2.1');
});

test('history checkpoint rejects orphaned nested layers instead of undercounting memory', () => {
  const history = new History(2);
  const doc = { id: 'nested', name: 'Nested', width: 1, height: 1, colorMode: 'RGB', bitDepth: 8,
    activeId: null, createdAt: '', channels: [], layers: [
      { id: 'g1', type: 'group', parentId: null },
      { id: 'g2', type: 'group', parentId: 'g1' },
      { id: 'orphan', type: 'raster', parentId: 'missing', canvas: { width: 1, height: 1 }, mask: null }
    ] };
  assert.equal(history.checkpoint(doc), false);
  assert.equal(history.lastWarning, true);
  assert.equal(history.undoStack.length, 0);
});
