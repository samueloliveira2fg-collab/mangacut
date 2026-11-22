import test from 'node:test';
import assert from 'node:assert/strict';
import { estimatePsdExportMemory, parsePsd } from '../src/io/psd.js';

function makeMinimalPsd() {
  const bytes = new Uint8Array(40);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('8BPS'), 0);
  view.setUint16(4, 1, false); view.setUint16(12, 1, false);
  view.setUint32(14, 1, false); view.setUint32(18, 1, false);
  view.setUint16(22, 8, false); view.setUint16(24, 1, false);
  view.setUint32(26, 0, false); view.setUint32(30, 0, false); view.setUint32(34, 0, false);
  return bytes;
}

test('export memory estimate counts deep nested groups and rasters', () => {
  const doc = { width: 10, height: 10, colorMode: 'RGB', layers: [
    { id: 'g1', type: 'group' }, { id: 'g2', type: 'group', parentId: 'g1' },
    { id: 'r1', type: 'raster', parentId: 'g2', canvas: { width: 2, height: 3 }, mask: null }
  ] };
  assert.equal(estimatePsdExportMemory(doc), 1600 + 2 * 3 * 16);
});

test('export memory estimate rejects duplicate ids and orphaned/cyclic hierarchies', () => {
  const base = { width: 10, height: 10, colorMode: 'RGB' };
  assert.equal(estimatePsdExportMemory({ ...base, layers: [{ id: 'x', type: 'group' }, { id: 'x', type: 'raster' }] }), Infinity);
  assert.equal(estimatePsdExportMemory({ ...base, layers: [{ id: 'x', parentId: 'missing', type: 'group' }] }), Infinity);
  assert.equal(estimatePsdExportMemory({ ...base, layers: [{ id: 'x', parentId: 'x', type: 'group' }] }), Infinity);
});

test('PSD header-only parse remains bounded and rejects unsupported/truncated composite', async () => {
  await assert.rejects(() => parsePsd(makeMinimalPsd().buffer), /truncado|inválido/);
});
