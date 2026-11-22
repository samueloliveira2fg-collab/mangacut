import { makeCanvas } from '../core/state.js';
import { createDocument } from '../core/document.js';

const DB_NAME = 'mangacut-studio-2';
const STORE = 'recovery';
const KEY = 'latest-document';
const RECOVERY_FORMAT = 'mcut-recovery-blob';
const RECOVERY_VERSION = 2;

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('IndexedDB indisponível neste navegador.'));
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Falha ao abrir armazenamento local.'));
  });
}

async function transaction(mode, action) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const request = action(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Operação local cancelada.'));
    });
  } catch (error) { db.close(); throw error; }
}

function canvasToBlob(canvas) {
  if (!canvas) return Promise.resolve(null);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível codificar a imagem de recuperação.')), 'image/png'));
}

async function blobToCanvas(blob, width, height) {
  if (!blob) return null;
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
  } else {
    const image = new Image();
    image.src = URL.createObjectURL(blob);
    try { await image.decode(); ctx.drawImage(image, 0, 0); }
    finally { URL.revokeObjectURL(image.src); }
  }
  return canvas;
}

function layerMetadata(layer) {
  const meta = { ...layer, params: layer.params ? { ...layer.params } : undefined };
  delete meta.canvas;
  delete meta.mask;
  return meta;
}

export async function saveRecoveryPoint(doc) {
  if (!doc) return false;
  const layers = [];
  for (const layer of doc.layers || []) {
    const entry = { meta: layerMetadata(layer), pixels: null, mask: null };
    if (layer.type === 'raster') {
      entry.pixels = await canvasToBlob(layer.canvas);
      entry.mask = await canvasToBlob(layer.mask);
    }
    layers.push(entry);
  }
  const channels = [];
  for (const channel of doc.channels || []) {
    const meta = { ...channel }; delete meta.canvas;
    channels.push({ meta, pixels: await canvasToBlob(channel.canvas) });
  }
  const payload = {
    format: RECOVERY_FORMAT, version: RECOVERY_VERSION,
    savedAt: new Date().toISOString(),
    doc: { id: doc.id, name: doc.name, width: doc.width, height: doc.height, colorMode: doc.colorMode, bitDepth: doc.bitDepth, activeId: doc.activeId, createdAt: doc.createdAt, metadata: doc.metadata ? structuredClone(doc.metadata) : {}, guides: Array.isArray(doc.guides) ? structuredClone(doc.guides) : [], grid: doc.grid ? structuredClone(doc.grid) : null, colorProfile: doc.colorProfile || null },
    layers, channels
  };
  await transaction('readwrite', store => store.put(payload, KEY));
  return true;
}

export async function loadRecoveryPoint() {
  const payload = await transaction('readonly', store => store.get(KEY));
  if (!payload) return null;
  // Backward-compatible reader for V6's original base64/JSON recovery record.
  if (payload.format === 'mcut' && Array.isArray(payload.layers)) {
    const { deserializeProject } = await import('./project.js');
    return { doc: await deserializeProject(payload), savedAt: payload.recoverySavedAt || null };
  }
  if (payload.format !== RECOVERY_FORMAT || payload.version !== RECOVERY_VERSION || !payload.doc) return null;
  const meta = payload.doc;
  const doc = createDocument(meta.width, meta.height, meta.name || 'Projeto recuperado', 'transparent');
  doc.id = meta.id || doc.id; doc.createdAt = meta.createdAt || doc.createdAt;
  doc.colorMode = meta.colorMode || 'RGB'; doc.bitDepth = meta.bitDepth || 8;
  doc.metadata = meta.metadata && typeof meta.metadata === 'object' ? structuredClone(meta.metadata) : {};
  doc.guides = Array.isArray(meta.guides) ? structuredClone(meta.guides) : [];
  doc.grid = meta.grid && typeof meta.grid === 'object' ? structuredClone(meta.grid) : null;
  doc.colorProfile = typeof meta.colorProfile === 'string' ? meta.colorProfile : null;
  doc.activeId = meta.activeId || null; doc.layers = [];
  for (const item of payload.layers || []) {
    const layer = { ...item.meta };
    if (layer.type === 'raster') {
      layer.canvas = await blobToCanvas(item.pixels, meta.width, meta.height);
      layer.mask = await blobToCanvas(item.mask, meta.width, meta.height);
      if (!layer.canvas) throw new Error(`A recuperação da camada "${layer.name}" está incompleta.`);
    }
    doc.layers.push(layer);
  }
  doc.channels = [];
  for (const item of payload.channels || []) {
    const canvas = await blobToCanvas(item.pixels, meta.width, meta.height);
    if (canvas) doc.channels.push({ ...item.meta, canvas });
  }
  return { doc, savedAt: payload.savedAt || null };
}

export async function clearRecoveryPoint() {
  await transaction('readwrite', store => store.delete(KEY));
}
