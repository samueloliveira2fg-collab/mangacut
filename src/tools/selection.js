import { makeCanvas, state } from '../core/state.js';

export const MAX_SELECTION_PIXELS = 12_000_000;
export function clearSelection() { state.selectionMask = null; state.selectionRect = null; }

function makeSelectionCanvas(doc) { return makeCanvas(doc.width, doc.height); }
function mergeSelection(mask, mode = 'replace') {
  if (mode === 'replace') { state.selectionMask = mask; return; }
  if (!state.selectionMask) { state.selectionMask = mode === 'add' ? mask : null; return; }
  const w = mask.width, h = mask.height;
  const a = state.selectionMask.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h);
  const b = mask.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h);
  for (let i = 3; i < a.data.length; i += 4) {
    if (mode === 'subtract') a.data[i] = Math.max(0, a.data[i] - b.data[i]);
    else if (mode === 'intersect') a.data[i] = Math.min(a.data[i], b.data[i]);
    else a.data[i] = Math.max(a.data[i], b.data[i]);
  }
  const combined = makeCanvas(w, h); combined.getContext('2d').putImageData(a, 0, 0); state.selectionMask = combined;
}

export function makeRectSelection(doc, x1, y1, x2, y2, mode = 'replace') {
  const x = Math.max(0, Math.floor(Math.min(x1, x2))), y = Math.max(0, Math.floor(Math.min(y1, y2)));
  const right = Math.min(doc.width, Math.ceil(Math.max(x1, x2))), bottom = Math.min(doc.height, Math.ceil(Math.max(y1, y2)));
  if (right <= x || bottom <= y) { if (mode === 'replace') clearSelection(); return; }
  const mask = makeSelectionCanvas(doc), ctx = mask.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, right - x, bottom - y);
  mergeSelection(mask, mode); state.selectionRect = { x, y, width: right - x, height: bottom - y, shape: 'rect' };
}

export function makeEllipseSelection(doc, x1, y1, x2, y2, mode = 'replace') {
  const left = Math.max(0, Math.min(x1, x2)), top = Math.max(0, Math.min(y1, y2));
  const right = Math.min(doc.width, Math.max(x1, x2)), bottom = Math.min(doc.height, Math.max(y1, y2));
  if (right <= left || bottom <= top) { if (mode === 'replace') clearSelection(); return; }
  const mask = makeSelectionCanvas(doc), ctx = mask.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse((left + right) / 2, (top + bottom) / 2, (right - left) / 2, (bottom - top) / 2, 0, 0, Math.PI * 2); ctx.fill();
  mergeSelection(mask, mode); state.selectionRect = { x: left, y: top, width: right - left, height: bottom - top, shape: 'ellipse' };
}

export function makeLassoSelection(doc, points, mode = 'replace') {
  if (!Array.isArray(points) || points.length < 3) { if (mode === 'replace') clearSelection(); return 0; }
  const mask = makeSelectionCanvas(doc), ctx = mask.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath(); ctx.fill(); mergeSelection(mask, mode); state.selectionRect = { x: 0, y: 0, width: doc.width, height: doc.height, shape: 'lasso' };
  return points.length;
}

function rgbDistance(data, a, b) {
  const i = a * 4, j = b * 4;
  const dr = data[i] - data[j], dg = data[i + 1] - data[j + 1], db = data[i + 2] - data[j + 2], da = data[i + 3] - data[j + 3];
  return Math.sqrt(dr * dr + dg * dg + db * db + da * da * 0.5);
}

function floodRegion(doc, composite, x, y, tolerance, radius = Infinity) {
  const w = doc.width, h = doc.height;
  if (w * h > MAX_SELECTION_PIXELS) throw new Error('Seleção por cor limitada a 12 megapixels nesta versão para proteger a memória.');
  const data = composite.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const sx = Math.max(0, Math.min(w - 1, Math.floor(x))), sy = Math.max(0, Math.min(h - 1, Math.floor(y)));
  const start = sy * w + sx, visited = new Uint8Array(w * h), selected = new Uint8Array(w * h), stack = [start];
  const threshold = Math.max(0, Number(tolerance)) * 2.2, radius2 = radius * radius;
  visited[start] = 1; let count = 0;
  while (stack.length) {
    const index = stack.pop(), px = index % w, py = (index / w) | 0;
    if ((px - sx) ** 2 + (py - sy) ** 2 > radius2) continue;
    selected[index] = 255; count++;
    const candidates = [];
    if (px > 0) candidates.push(index - 1);
    if (px < w - 1) candidates.push(index + 1);
    if (py > 0) candidates.push(index - w);
    if (py < h - 1) candidates.push(index + w);
    for (const next of candidates) if (!visited[next] && rgbDistance(data, start, next) <= threshold) { visited[next] = 1; stack.push(next); }
  }
  const mask = makeSelectionCanvas(doc), mctx = mask.getContext('2d');
  const image = mctx.createImageData(w, h);
  for (let i = 0; i < selected.length; i++) { const p = i * 4; image.data[p] = image.data[p + 1] = image.data[p + 2] = 255; image.data[p + 3] = selected[i]; }
  mctx.putImageData(image, 0, 0);
  return { mask, count, sx, sy };
}

export function magicWand(doc, composite, x, y, tolerance = 24, { contiguous = true, mode = 'replace' } = {}) {
  if (!contiguous) throw new Error('A seleção não contígua será adicionada em uma próxima etapa.');
  const { mask, count } = floodRegion(doc, composite, x, y, tolerance);
  mergeSelection(mask, mode); state.selectionRect = { x: 0, y: 0, width: doc.width, height: doc.height, wand: true };
  return count;
}

export function quickSelect(doc, composite, x, y, tolerance = 28, radius = 48, mode = 'add') {
  const { mask, count } = floodRegion(doc, composite, x, y, tolerance, Math.max(1, radius));
  mergeSelection(mask, mode); state.selectionRect = { x: 0, y: 0, width: doc.width, height: doc.height, quick: true };
  return count;
}

export function invertSelection(doc) {
  if (!state.selectionMask) return false;
  const source = state.selectionMask;
  const ctx = source.getContext('2d', { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, doc.width, doc.height);
  for (let i = 3; i < data.data.length; i += 4) data.data[i] = 255 - data.data[i];
  const inverted = makeCanvas(source.width, source.height); inverted.getContext('2d').putImageData(data, 0, 0); state.selectionMask = inverted; state.selectionRect = { x: 0, y: 0, width: doc.width, height: doc.height, inverted: true }; return true;
}

export function featherSelection(radius = 2) {
  if (!state.selectionMask) return false;
  const source = state.selectionMask, blurred = makeCanvas(source.width, source.height), ctx = blurred.getContext('2d');
  ctx.filter = `blur(${Math.max(0, Math.min(64, Number(radius) || 0))}px)`; ctx.drawImage(source, 0, 0); ctx.filter = 'none';
  state.selectionMask = blurred; state.selectionRect = { x: 0, y: 0, width: source.width, height: source.height, feathered: true }; return true;
}

export function selectAll(doc) { makeRectSelection(doc, 0, 0, doc.width, doc.height); }


// Edge refinement: soften mask antialiasing, then apply a controllable contrast
// curve so semi-transparent edge pixels can be tightened or expanded.
export function refineSelection(radius = 2, edgeContrast = 0.18) {
  if (!state.selectionMask) return false;
  const source = state.selectionMask;
  const blurred = makeCanvas(source.width, source.height);
  const ctx = blurred.getContext('2d', { willReadFrequently: true });
  ctx.filter = `blur(${Math.max(0, Math.min(32, Number(radius) || 0))}px)`;
  ctx.drawImage(source, 0, 0);
  ctx.filter = 'none';
  const image = ctx.getImageData(0, 0, source.width, source.height);
  const contrast = Math.max(0.02, Math.min(0.48, Number(edgeContrast) || 0.18));
  const low = 0.5 - contrast, high = 0.5 + contrast;
  for (let i = 3; i < image.data.length; i += 4) {
    const alpha = image.data[i] / 255;
    const t = Math.max(0, Math.min(1, (alpha - low) / (high - low)));
    image.data[i] = Math.round(t * t * (3 - 2 * t) * 255);
  }
  const result = makeCanvas(source.width, source.height);
  result.getContext('2d').putImageData(image, 0, 0);
  state.selectionMask = result;
  state.selectionRect = { x: 0, y: 0, width: source.width, height: source.height, refined: true };
  return true;
}
