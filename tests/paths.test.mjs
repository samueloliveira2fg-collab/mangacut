import test from 'node:test';
import assert from 'node:assert/strict';
import { createPath, addAnchor, updateAnchor, samplePath, pathToSvg, exportPathsSvg } from '../src/tools/paths.js';

test('path model validates points and stores anchor handles', () => {
  const path = createPath({ id: 'p1', segments: [{ anchor: { x: 0, y: 0 }, out: { x: 5, y: 0 } }] });
  assert.equal(path.segments[0].out.x, 5);
  assert.throws(() => createPath({ segments: [{ anchor: { x: NaN, y: 0 } }] }), /finito/);
});

test('anchors can be added and updated immutably', () => {
  const original = createPath({ segments: [{ anchor: { x: 0, y: 0 } }] });
  const added = addAnchor(original, { x: 10, y: 10 }, { in: { x: 8, y: 10 }, smooth: true });
  const updated = updateAnchor(added, 1, { anchor: { x: 12, y: 10 }, out: { x: 14, y: 10 } });
  assert.equal(original.segments.length, 1);
  assert.equal(added.segments[1].anchor.x, 10);
  assert.equal(updated.segments[1].anchor.x, 12);
  assert.throws(() => updateAnchor(updated, 9, {}), RangeError);
});

test('cubic Bezier path sampling includes endpoints and intermediate curve points', () => {
  const path = createPath({ segments: [
    { anchor: { x: 0, y: 0 }, out: { x: 0, y: 10 } },
    { anchor: { x: 10, y: 0 }, in: { x: 10, y: 10 } }
  ] });
  const points = samplePath(path, 10);
  assert.equal(points.length, 11);
  assert.deepEqual(points[0], { x: 0, y: 0 });
  assert.deepEqual(points.at(-1), { x: 10, y: 0 });
  assert.ok(points.some(p => p.y > 7));
});

test('SVG export preserves open/closed paths and Bezier handles', () => {
  const open = createPath({ segments: [
    { anchor: { x: 0, y: 0 }, out: { x: 5, y: 0 } },
    { anchor: { x: 10, y: 10 }, in: { x: 5, y: 10 } }
  ] });
  const closed = createPath({ closed: true, segments: [
    { anchor: { x: 0, y: 0 } }, { anchor: { x: 20, y: 0 } }, { anchor: { x: 10, y: 20 } }
  ] });
  assert.match(pathToSvg(open), / C /);
  assert.doesNotMatch(pathToSvg(open), / Z$/);
  assert.match(pathToSvg(closed), / Z$/);
  const svg = exportPathsSvg([open, closed], { width: 100, height: 80 });
  assert.match(svg, /<svg xmlns=/);
  assert.equal((svg.match(/<path /g) ?? []).length, 2);
  assert.throws(() => exportPathsSvg([], { width: 0, height: 10 }), RangeError);
});
