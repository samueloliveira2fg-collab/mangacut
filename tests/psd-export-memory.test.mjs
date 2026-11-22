import test from 'node:test';
import assert from 'node:assert/strict';
import { estimatePsdExportMemory } from '../src/io/psd.js';

test('PSD export estimate has no fixed 40MP rejection threshold', () => {
  const doc = { width: 7000, height: 7000, colorMode: 'GRAY', layers: [] };
  const estimate = estimatePsdExportMemory(doc);
  assert.equal(estimate, 490_000_000);
  assert.ok(estimate < 512_000_000);
});

test('RGB layered export estimate accounts for higher temporary memory', () => {
  const doc = { width: 5000, height: 5000, colorMode: 'RGB', layers: [] };
  assert.equal(estimatePsdExportMemory(doc), 400_000_000);
});

test('layer and mask storage are included in export estimate', () => {
  const doc = {
    width: 100, height: 100, colorMode: 'RGB',
    layers: [{ id: 'raster-1', type: 'raster', canvas: { width: 80, height: 50 }, mask: { width: 80, height: 50 } }]
  };
  assert.equal(estimatePsdExportMemory(doc), 160_000 + 64_000 + 32_000);
});

test('invalid or overflowing export dimensions return Infinity', () => {
  assert.equal(estimatePsdExportMemory({ width: 0, height: 100, layers: [] }), Infinity);
  assert.equal(estimatePsdExportMemory({ width: Number.MAX_SAFE_INTEGER, height: 2, layers: [] }), Infinity);
});

test('nested group descendants are included in export memory estimate', async () => {
  const { estimatePsdExportMemory } = await import('../src/io/psd.js');
  const doc = {
    width: 100, height: 100, colorMode: 'RGB',
    layers: [
      { id: 'g1', type: 'group', parentId: null },
      { id: 'g2', type: 'group', parentId: 'g1' },
      { id: 'inside', type: 'raster', parentId: 'g2', canvas: { width: 10, height: 20 }, mask: null }
    ]
  };
  assert.equal(estimatePsdExportMemory(doc), 160_000 + 10 * 20 * 16);
});
