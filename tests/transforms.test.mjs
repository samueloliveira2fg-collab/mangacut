import test from 'node:test';
import assert from 'node:assert/strict';
import { documentToLayerInputPoint, layerToDocumentPoint } from '../src/core/transforms.js';

const close = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-8, `${label}: ${a} != ${b}`);

test('inverse layer mapping round-trips translation, scale and rotation', () => {
  const doc = { width: 1200, height: 800 };
  const layer = { x: 37, y: -21, scaleX: 1.7, scaleY: 0.65, rotation: 33 };
  for (const local of [{ x: 0, y: 0 }, { x: 120, y: 250 }, { x: 900, y: 600 }]) {
    const screen = layerToDocumentPoint(local, layer, doc);
    const mapped = documentToLayerInputPoint(screen, layer, doc);
    close(mapped.x - layer.x, local.x, 'local x');
    close(mapped.y - layer.y, local.y, 'local y');
  }
});

test('inverse layer mapping handles horizontal and vertical flips', () => {
  const doc = { width: 500, height: 300 };
  for (const layer of [
    { x: 0, y: 0, scaleX: -1, scaleY: 1, rotation: 0 },
    { x: 0, y: 0, scaleX: 1, scaleY: -1, rotation: 0 },
    { x: 10, y: 20, scaleX: -1.4, scaleY: -0.8, rotation: 90 }
  ]) {
    const local = { x: 73, y: 119 };
    const screen = layerToDocumentPoint(local, layer, doc);
    const mapped = documentToLayerInputPoint(screen, layer, doc);
    close(mapped.x - layer.x, local.x, 'flipped x');
    close(mapped.y - layer.y, local.y, 'flipped y');
  }
});

test('inverse mapping rejects zero or invalid scales instead of generating infinities', () => {
  assert.throws(() => documentToLayerInputPoint({ x: 1, y: 1 }, { scaleX: 0, scaleY: 1 }, { width: 10, height: 10 }), /escala inválida/);
});

test('selection conversion applies inverse layer transform in local pixel space', async () => {
  const { selectionToLayerCanvas } = await import('../src/core/transforms.js');
  let matrix = null, drawn = null;
  const selection = { width: 400, height: 300 };
  const layer = { x: 25, y: -12, scaleX: 2, scaleY: 0.5, rotation: 90, canvas: { width: 400, height: 300 } };
  const output = { getContext: () => ({ setTransform: (...args) => { matrix = args; }, drawImage: (...args) => { drawn = args; } }) };
  const result = selectionToLayerCanvas(selection, layer, { width: 400, height: 300 }, () => output);
  assert.equal(result, output);
  assert.equal(drawn[0], selection);
  assert.equal(matrix.length, 6);
  assert.ok(matrix.every(Number.isFinite));
});
