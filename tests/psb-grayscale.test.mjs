import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePsd, parsePsd } from '../src/io/psd.js';

test('PSB flattened export preserves grayscale mode and alpha', async () => {
  const imageData = { width: 2, height: 1, data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 64]) };
  const bytes = encodePsd(imageData, { psb: true, colorMode: 'GRAY' });
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint16(4, false), 2);
  assert.equal(view.getUint16(12, false), 2);
  assert.equal(view.getUint16(24, false), 1);
  const parsed = await parsePsd(bytes.buffer);
  assert.equal(parsed.colorMode, 1);
  assert.equal(parsed.version, 2);
  assert.deepEqual([...parsed.rgba], [54, 54, 54, 255, 182, 182, 182, 64]);
});
