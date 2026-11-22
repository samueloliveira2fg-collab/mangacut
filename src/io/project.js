import { makeCanvas } from '../core/state.js';
import { createDocument, MAX_CANVAS_DIMENSION } from '../core/document.js';

function canvasToDataURL(canvas) { return canvas ? canvas.toDataURL('image/png') : null; }

export function serializeProject(doc) {
  return {
    format: 'mcut', version: 4, app: 'MangaCut Studio 2.0',
    metadata: doc.metadata ? structuredClone(doc.metadata) : {},
    guides: Array.isArray(doc.guides) ? structuredClone(doc.guides) : [],
    grid: doc.grid ? structuredClone(doc.grid) : null,
    colorProfile: doc.colorProfile || null,
    name: doc.name, width: doc.width, height: doc.height,
    colorMode: doc.colorMode, bitDepth: doc.bitDepth, activeId: doc.activeId,
    channels: (doc.channels || []).map(channel => ({ ...channel, canvas: canvasToDataURL(channel.canvas) })),
    layers: doc.layers.map(layer => layer.type !== 'raster'
      ? { ...layer, params: layer.params ? { ...layer.params } : undefined }
      : { ...layer, canvas: canvasToDataURL(layer.canvas), mask: canvasToDataURL(layer.mask) })
  };
}

export function cropCanvasToAlpha(canvas) {
  if (!canvas) return null;
  const width = canvas.width, height = canvas.height;
  if (!width || !height) return { canvas, left: 0, top: 0, cropped: false };
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const pixels = ctx.getImageData(0, 0, width, height).data;
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (pixels[(y * width + x) * 4 + 3] === 0) continue;
    if (x < left) left = x; if (x > right) right = x;
    if (y < top) top = y; if (y > bottom) bottom = y;
  }
  if (right < left || bottom < top || (left === 0 && top === 0 && right === width - 1 && bottom === height - 1)) {
    return { canvas, left: 0, top: 0, cropped: false };
  }
  const cropped = makeCanvas(right - left + 1, bottom - top + 1);
  cropped.getContext('2d').drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
  return { canvas: cropped, left, top, cropped: true };
}

async function dataUrlToCanvas(url, width, height) {
  if (!url) return null;
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = makeCanvas(width, height);
  canvas.getContext('2d').drawImage(image, 0, 0);
  return canvas;
}

export async function deserializeProject(payload) {
  if (payload?.format !== 'mcut' || !Array.isArray(payload.layers)) throw new Error('Arquivo MCUT inválido.');
  if (!Number.isInteger(payload.width) || !Number.isInteger(payload.height) || payload.width < 1 || payload.height < 1 || payload.width > MAX_CANVAS_DIMENSION || payload.height > MAX_CANVAS_DIMENSION) {
    throw new Error(`Dimensões de projeto inválidas. Cada lado deve ter até ${MAX_CANVAS_DIMENSION.toLocaleString('pt-BR')} px.`);
  }
  const doc = createDocument(payload.width, payload.height, payload.name || 'Projeto MCUT', 'transparent');
  doc.layers = [];
  doc.metadata = payload.metadata && typeof payload.metadata === 'object' ? structuredClone(payload.metadata) : {};
  doc.guides = Array.isArray(payload.guides) ? structuredClone(payload.guides) : [];
  doc.grid = payload.grid && typeof payload.grid === 'object' ? structuredClone(payload.grid) : null;
  doc.colorProfile = typeof payload.colorProfile === 'string' ? payload.colorProfile : null;
  for (const raw of payload.layers) {
    if (raw.type !== 'raster') {
      doc.layers.push({ ...raw, params: raw.params ? { ...raw.params } : undefined, scaleX: Number(raw.scaleX ?? 1), scaleY: Number(raw.scaleY ?? 1), rotation: Number(raw.rotation ?? 0) });
      continue;
    }
    const sourceCanvas = await dataUrlToCanvas(raw.canvas || raw.png, payload.width, payload.height);
    if (!sourceCanvas) throw new Error(`A camada "${raw.name || 'sem nome'}" não contém pixels.`);
    const cropped = cropCanvasToAlpha(sourceCanvas);
    const maskSource = await dataUrlToCanvas(raw.mask, payload.width, payload.height);
    let mask = maskSource;
    if (maskSource && cropped.cropped) {
      mask = makeCanvas(cropped.canvas.width, cropped.canvas.height);
      mask.getContext('2d').drawImage(maskSource, cropped.left, cropped.top, mask.width, mask.height, 0, 0, mask.width, mask.height);
    }
    doc.layers.push({ ...raw, type: 'raster', canvas: cropped.canvas, mask: mask || null,
      x: Number(raw.x || 0) + cropped.left, y: Number(raw.y || 0) + cropped.top,
      scaleX: Number(raw.scaleX ?? 1), scaleY: Number(raw.scaleY ?? 1), rotation: Number(raw.rotation ?? 0) });
  }
  doc.channels = [];
  for (const channel of payload.channels || []) {
    const canvas = await dataUrlToCanvas(channel.canvas, payload.width, payload.height);
    if (canvas) doc.channels.push({ ...channel, canvas });
  }
  doc.activeId = payload.activeId || doc.layers.find(layer => layer.type === 'raster')?.id || doc.layers[0]?.id || null;
  if (!doc.layers.length) throw new Error('O projeto não contém camadas.');
  return doc;
}

export async function openProjectFile(file) {
  const text = await file.text();
  return deserializeProject(JSON.parse(text));
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function saveProjectFile(doc) {
  const payload = serializeProject(doc);
  downloadBlob(new Blob([JSON.stringify(payload)], { type: 'application/json' }), `${doc.name.replace(/\.[^.]+$/, '') || 'MangaCut'}.mcut`);
}
