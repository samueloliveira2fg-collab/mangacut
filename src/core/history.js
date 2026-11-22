import { cloneDocument } from './document.js';

const HISTORY_MEMORY_BUDGET = 96 * 1024 * 1024;
const TILE_SIZE = 256;

function estimateDocumentBytes(doc) {
  let bytes = 0;
  const nodes = doc?.layers || [];
  const byParent = new Map();
  for (const node of nodes) {
    const key = node.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(node);
  }
  const visited = new Set();
  const stack = [...(byParent.get(null) || [])];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node.id !== 'string' || visited.has(node.id)) return Infinity;
    visited.add(node.id);
    if (node.type === 'group') stack.push(...(byParent.get(node.id) || []));
    if (node.type !== 'raster') continue;
    const width = node.canvas?.width || 0, height = node.canvas?.height || 0;
    const pixels = width * height;
    if (!Number.isSafeInteger(pixels) || pixels < 0) return Infinity;
    bytes += pixels * 4;
    if (node.mask) bytes += node.mask.width * node.mask.height * 4;
    if (!Number.isSafeInteger(bytes)) return Infinity;
  }
  if (visited.size !== nodes.length) return Infinity;
  for (const channel of doc?.channels || []) if (channel.canvas) {
    const size = channel.canvas.width * channel.canvas.height * 4;
    if (!Number.isSafeInteger(size) || size < 0) return Infinity;
    bytes += size;
    if (!Number.isSafeInteger(bytes)) return Infinity;
  }
  return bytes;
}

function targetCanvas(doc, layerId, target) {
  const layer = doc?.layers?.find(item => item.id === layerId);
  if (!layer || layer.type !== 'raster') return null;
  return target === 'mask' ? layer.mask : layer.canvas;
}

function applyTileImages(doc, entry, side) {
  const canvas = targetCanvas(doc, entry.layerId, entry.target);
  if (!canvas) return false;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  for (const tile of entry.tiles) {
    const image = new ImageData(new Uint8ClampedArray(tile[side]), tile.width, tile.height);
    ctx.putImageData(image, tile.x, tile.y);
  }
  return true;
}

export class History {
  constructor(limit = 6) {
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
    this.lastWarning = false;
    this.retainedBytes = 0;
  }

  _clearRedo() {
    for (const entry of this.redoStack) this.retainedBytes -= entry.bytes || 0;
    this.redoStack.length = 0;
  }

  _trim() {
    while (this.retainedBytes > HISTORY_MEMORY_BUDGET || this.undoStack.length > this.limit) {
      const entry = this.undoStack.length ? this.undoStack.shift() : this.redoStack.shift();
      if (!entry) break;
      this.retainedBytes = Math.max(0, this.retainedBytes - (entry.bytes || 0));
    }
  }

  checkpoint(doc, label = 'Alteração') {
    if (!doc) return false;
    const bytes = estimateDocumentBytes(doc);
    if (bytes > HISTORY_MEMORY_BUDGET) {
      this.lastWarning = true;
      return false;
    }
    this.lastWarning = false;
    this._clearRedo();
    const snapshot = cloneDocument(doc);
    this.undoStack.push({ kind: 'snapshot', doc: snapshot, label, bytes });
    this.retainedBytes += bytes;
    this._trim();
    return true;
  }

  // Called once at the end of a paint/erase gesture. Memory is proportional
  // to touched 256px tiles, not the full canvas or every intermediate pointer event.
  recordTileStroke(doc, layerId, target, tiles, label = 'Pincel') {
    if (!doc || !tiles?.length) return false;
    const canvas = targetCanvas(doc, layerId, target);
    if (!canvas) return false;
    const records = [];
    let bytes = 0;
    for (const tile of tiles) {
      const after = canvas.getContext('2d', { willReadFrequently: true }).getImageData(tile.x, tile.y, tile.width, tile.height).data;
      const before = new Uint8ClampedArray(tile.before);
      const next = new Uint8ClampedArray(after);
      let changed = false;
      for (let i = 0; i < before.length; i++) if (before[i] !== next[i]) { changed = true; break; }
      if (!changed) continue;
      records.push({ x: tile.x, y: tile.y, width: tile.width, height: tile.height, before, after: next });
      bytes += before.byteLength + next.byteLength;
    }
    if (!records.length) return false;
    this._clearRedo();
    this.undoStack.push({ kind: 'tiles', layerId, target, tiles: records, label, bytes });
    this.retainedBytes += bytes;
    this.lastWarning = false;
    this._trim();
    return true;
  }

  undo(currentDoc) {
    if (!this.undoStack.length) return null;
    const entry = this.undoStack.pop();
    if (entry.kind === 'tiles') {
      if (!applyTileImages(currentDoc, entry, 'before')) { this.undoStack.push(entry); return null; }
      this.redoStack.push(entry);
      return currentDoc;
    }
    const current = cloneDocument(currentDoc);
    this.retainedBytes = Math.max(0, this.retainedBytes - (entry.bytes || 0));
    const bytes = estimateDocumentBytes(current);
    this.redoStack.push({ kind: 'snapshot', doc: current, label: 'Refazer', bytes });
    this.retainedBytes += bytes;
    this._trim();
    return entry.doc;
  }

  redo(currentDoc) {
    if (!this.redoStack.length) return null;
    const entry = this.redoStack.pop();
    if (entry.kind === 'tiles') {
      if (!applyTileImages(currentDoc, entry, 'after')) { this.redoStack.push(entry); return null; }
      this.undoStack.push(entry);
      return currentDoc;
    }
    const current = cloneDocument(currentDoc);
    this.retainedBytes = Math.max(0, this.retainedBytes - (entry.bytes || 0));
    const bytes = estimateDocumentBytes(current);
    this.undoStack.push({ kind: 'snapshot', doc: current, label: 'Desfazer', bytes });
    this.retainedBytes += bytes;
    this._trim();
    return entry.doc;
  }

  reset() { this.undoStack.length = 0; this.redoStack.length = 0; this.lastWarning = false; this.retainedBytes = 0; }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
}
