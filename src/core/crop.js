import { makeCanvas } from './state.js';

function copyCanvasRegion(source, sx, sy, width, height) {
  const canvas = makeCanvas(width, height);
  if (width > 0 && height > 0) {
    canvas.getContext('2d').drawImage(source, sx, sy, width, height, 0, 0, width, height);
  }
  return canvas;
}

function selectionBounds(mask) {
  if (!mask?.width || !mask?.height) return null;
  const data = mask.getContext('2d', { willReadFrequently: true })
    .getImageData(0, 0, mask.width, mask.height).data;
  let left = mask.width, top = mask.height, right = -1, bottom = -1;
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      if (!data[(y * mask.width + x) * 4 + 3]) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return right < left ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function hasTransform(layer) {
  return Math.abs(Number(layer.scaleX ?? 1) - 1) > 1e-9
    || Math.abs(Number(layer.scaleY ?? 1) - 1) > 1e-9
    || Math.abs(Number(layer.rotation ?? 0)) > 1e-9;
}

export function cropDocumentToSelection(doc, mask) {
  if (!doc || !Array.isArray(doc.layers)) throw new TypeError('Documento inválido.');
  if (mask?.width !== doc.width || mask?.height !== doc.height) {
    throw new Error('A seleção não corresponde ao tamanho do documento.');
  }
  const bounds = selectionBounds(mask);
  if (!bounds) return { cropped: false, reason: 'empty' };
  if (doc.layers.some(layer => ['raster', 'text'].includes(layer.type) && hasTransform(layer))) {
    return { cropped: false, reason: 'transformed' };
  }

  const { left, top, width, height } = bounds;
  for (const layer of doc.layers) {
    if (layer.type === 'text') {
      layer.x = Number(layer.x || 0) - left;
      layer.y = Number(layer.y || 0) - top;
      continue;
    }
    if (layer.type !== 'raster' || !layer.canvas) continue;

    const layerX = Number(layer.x || 0), layerY = Number(layer.y || 0);
    const x1 = Math.max(left, layerX), y1 = Math.max(top, layerY);
    const x2 = Math.min(left + width, layerX + layer.canvas.width);
    const y2 = Math.min(top + height, layerY + layer.canvas.height);
    if (x2 <= x1 || y2 <= y1) {
      layer.canvas = makeCanvas(1, 1);
      layer.mask = layer.mask ? makeCanvas(1, 1) : null;
      layer.x = 0; layer.y = 0;
      continue;
    }

    const sx = x1 - layerX, sy = y1 - layerY;
    const cropWidth = x2 - x1, cropHeight = y2 - y1;
    layer.canvas = copyCanvasRegion(layer.canvas, sx, sy, cropWidth, cropHeight);
    if (layer.mask) layer.mask = copyCanvasRegion(layer.mask, sx, sy, cropWidth, cropHeight);
    layer.x = x1 - left; layer.y = y1 - top;
  }
  for (const channel of doc.channels || []) {
    if (!channel.canvas) continue;
    channel.canvas = copyCanvasRegion(channel.canvas, left, top, width, height);
  }
  doc.width = width; doc.height = height;
  return { cropped: true, ...bounds };
}
