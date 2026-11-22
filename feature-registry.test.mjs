import test from 'node:test';
import assert from 'node:assert/strict';
import { featureRegistry, getFeatures } from '../src/features/registry.js';

test('feature registry has unique stable identifiers', () => {
  const ids = featureRegistry.map(feature => feature.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('feature registry exposes implemented, partial and planned groups', () => {
  for (const status of ['implemented', 'partial', 'planned']) assert.ok(getFeatures(status).length > 0);
  assert.equal(getFeatures('unknown').length, 0);
});
