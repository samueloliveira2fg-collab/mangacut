import { makeCanvas, state } from './state.js';

export const MAX_CANVAS_DIMENSION = 32_767;

export function estimateCanvasMemory(width, height, layers = 1, bytesPerPixel = 4) {
  const pixels = Math.max(0, Number(width) || 0) * Math.max(0, Number(height) || 0);
  return Math.ceil(pixels * Math.max(1, Number(layers) || 1) * Math.max(1, Number(bytesPerPixel) || 4));
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'desconhecido';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes, unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function createDocument(width, height, name = 'Sem título-1', background = 'transparent') {
  width = Math.floor(Number(width));
  height = Math.floor(Number(height));
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error('Dimensões inválidas.');
  }
  if (width > MAX_CANVAS_DIMENSION || height > MAX_CANVAS_DIMENSION) {
    throw new Error(`Cada lado do documento deve ter no máximo ${MAX_CANVAS_DIMENSION.toLocaleString('pt-BR')} px, limite técnico comum dos navegadores.`);
  }
  const doc = { id: crypto.randomUUID(), name, width, height, colorMode: 'RGB', bitDepth: 8, layers: [], channels: [], activeId: null, createdAt: new Date().toISOString(), metadata: {}, guides: [], grid: null, colorProfile: null };
  if (background !== 'transparent') {
    const layer = createLayer(doc, 'Plano de fundo');
    const ctx = layer.canvas.getContext('2d');
    ctx.fillStyle = background === 'white' ? '#ffffff' : '#000000';
    ctx.fillRect(0, 0, width, height);
    layer.locked = true;
    doc.layers.push(layer);
    doc.activeId = layer.id;
  } else {
    const layer = createLayer(doc, 'Camada 1');
    doc.layers.push(layer);
    doc.activeId = layer.id;
  }
  return doc;
}

export function createLayer(doc, name = 'Camada', sourceCanvas = null, parentId = null) {
  const canvas = sourceCanvas || makeCanvas(doc.width, doc.height);
  return {
    id: crypto.randomUUID(), type: 'raster', name, canvas, mask: null,
    visible: true, opacity: 1, blend: 'source-over', x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0,
    parentId, locked: false, clipping: false, expanded: true
  };
}

export function createGroup(name = 'Grupo', parentId = null) {
  return { id: crypto.randomUUID(), type: 'group', name, visible: true, opacity: 1, blend: 'source-over', parentId, locked: false, expanded: true };
}

export function createAdjustmentLayer(name = 'Ajuste', kind = 'brightnessContrast', parentId = null) {
  return { id: crypto.randomUUID(), type: 'adjustment', name, kind, params: { brightness: 0, contrast: 0, saturation: 0 }, visible: true, opacity: 1, blend: 'source-over', parentId, locked: false, expanded: true };
}

export function createTextLayer(doc, text, x = 0, y = 0, options = {}) {
  return { id: crypto.randomUUID(), type: 'text', name: options.name || `Texto: ${String(text).slice(0, 22)}`, text: String(text), x, y, fontFamily: options.fontFamily || 'Arial', fontSize: Number(options.fontSize || 48), color: options.color || '#111111', fontWeight: options.fontWeight || 'normal', fontStyle: options.fontStyle || 'normal', textAlign: options.textAlign || 'left', visible: true, opacity: 1, blend: 'source-over', parentId: options.parentId ?? null, locked: false, scaleX: 1, scaleY: 1, rotation: 0, expanded: true };
}

export function activeNode(doc = state.doc) {
  return doc?.layers.find(layer => layer.id === doc.activeId) || null;
}

export function findNode(id, doc = state.doc) {
  return doc?.layers.find(layer => layer.id === id) || null;
}

export function childrenOf(parentId, doc = state.doc) {
  return (doc?.layers || []).filter(layer => (layer.parentId ?? null) === (parentId ?? null));
}

export function addNode(doc, node, index = null) {
  if (index == null || index < 0 || index > doc.layers.length) doc.layers.push(node);
  else doc.layers.splice(index, 0, node);
  doc.activeId = node.id;
  return node;
}

export function deepCloneCanvas(source) {
  const copy = makeCanvas(source.width, source.height);
  copy.getContext('2d').drawImage(source, 0, 0);
  return copy;
}

export function cloneDocument(doc) {
  return {
    id: doc.id, name: doc.name, width: doc.width, height: doc.height,
    colorMode: doc.colorMode, bitDepth: doc.bitDepth, activeId: doc.activeId,
    createdAt: doc.createdAt, metadata: doc.metadata ? structuredClone(doc.metadata) : {},
    guides: Array.isArray(doc.guides) ? structuredClone(doc.guides) : [],
    grid: doc.grid ? structuredClone(doc.grid) : null, colorProfile: doc.colorProfile || null,
    channels: (doc.channels || []).map(channel => ({ ...channel, canvas: deepCloneCanvas(channel.canvas) })),
    layers: doc.layers.map(layer => layer.type !== 'raster'
      ? { ...layer, params: layer.params ? { ...layer.params } : undefined }
      : { ...layer, canvas: deepCloneCanvas(layer.canvas), mask: layer.mask ? deepCloneCanvas(layer.mask) : null })
  };
}

export function getActiveRaster(doc = state.doc) {
  const node = activeNode(doc);
  return node?.type === 'raster' ? node : null;
}

export function addMask(layer, width, height) {
  if (!layer || layer.type !== 'raster') throw new Error('Selecione uma camada raster para adicionar uma máscara.');
  if (layer.mask) return layer.mask;
  layer.mask = makeCanvas(width, height);
  const ctx = layer.mask.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  return layer.mask;
}

export function nodeIndex(doc, id) { return doc.layers.findIndex(layer => layer.id === id); }

export function saveAlphaChannel(doc, name, canvas) {
  if (!doc || !canvas) throw new Error('Não há seleção para salvar.');
  const copy = deepCloneCanvas(canvas);
  const channel = { id: crypto.randomUUID(), name: name || `Alpha ${doc.channels.length + 1}`, type: 'alpha', canvas: copy };
  doc.channels ||= []; doc.channels.push(channel); return channel;
}

export function getAlphaChannel(doc, id) { return (doc?.channels || []).find(channel => channel.id === id) || null; }
