import { makeCanvas, state } from '../core/state.js';
import { getActiveRaster } from '../core/document.js';
import { documentToLayerInputPoint, selectionToLayerCanvas } from '../core/transforms.js';

export class PaintController {
  constructor({ getDocument, getSelection, checkpoint, recordStroke, commit, render, notify }) {
    Object.assign(this, { getDocument, getSelection, checkpoint, recordStroke, commit, render, notify });
    this.active = false;
    this.target = null;
    this.last = null;
    this.stroke = null;
    this.startLayerId = null;
    this.beforeTiles = new Map();
    this.targetKind = 'canvas';
  }

  begin(point, tool, pressure = 1) {
    const doc = this.getDocument();
    const layer = getActiveRaster(doc);
    if (!doc || !layer) return false;
    if (layer.locked) { this.notify('Esta camada está bloqueada.'); return false; }
    if (state.editMask && !layer.mask) { this.notify('Adicione uma máscara antes de editá-la.'); return false; }
    this.beforeTiles.clear();
    this.targetKind = state.editMask ? 'mask' : 'canvas';
    this.target = state.editMask ? layer.mask : layer.canvas;
    this.startLayerId = layer.id;
    this.stroke = makeCanvas(doc.width, doc.height);
    this.active = true;
    const mapped = documentToLayerInputPoint(point, layer, doc);
    this.last = { x: mapped.x - layer.x, y: mapped.y - layer.y };
    this._captureBounds(this.last, this.last, doc.width, doc.height);
    this._dab(this.last, tool, pressure);
    return true;
  }

  move(point, tool, pressure = 1) {
    if (!this.active || !this.target) return;
    const doc = this.getDocument();
    const layer = doc?.layers.find(item => item.id === this.startLayerId);
    if (!layer) return;
    const mapped = documentToLayerInputPoint(point, layer, doc);
    const current = { x: mapped.x - layer.x, y: mapped.y - layer.y };
    this._captureBounds(this.last, current, doc.width, doc.height);
    this._segment(this.last, current, tool, pressure);
    this.last = current;
    this.render();
  }

  _captureBounds(from, to, width, height) {
    if (!this.target) return;
    const radius = Math.max(1, Math.ceil(state.brushSize / 2) + 1);
    const x0 = Math.max(0, Math.floor(Math.min(from.x, to.x) - radius));
    const y0 = Math.max(0, Math.floor(Math.min(from.y, to.y) - radius));
    const x1 = Math.min(width, Math.ceil(Math.max(from.x, to.x) + radius + 1));
    const y1 = Math.min(height, Math.ceil(Math.max(from.y, to.y) + radius + 1));
    if (x1 <= x0 || y1 <= y0) return;
    const ctx = this.target.getContext('2d', { willReadFrequently: true });
    const tileSize = 256;
    const tx0 = Math.floor(x0 / tileSize), ty0 = Math.floor(y0 / tileSize);
    const tx1 = Math.floor((x1 - 1) / tileSize), ty1 = Math.floor((y1 - 1) / tileSize);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const x = tx * tileSize, y = ty * tileSize;
      const w = Math.min(tileSize, width - x), h = Math.min(tileSize, height - y);
      const key = `${tx}:${ty}`;
      if (!this.beforeTiles.has(key) && w > 0 && h > 0) {
        this.beforeTiles.set(key, { x, y, width: w, height: h, before: new Uint8ClampedArray(ctx.getImageData(x, y, w, h).data) });
      }
    }
  }

  _style(ctx, tool, pressure) {
    const alpha = state.brushOpacity * Math.max(0.15, Math.min(1, pressure || 1));
    ctx.globalAlpha = alpha;
    ctx.lineWidth = state.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = state.editMask ? '#ffffff' : state.color;
    ctx.fillStyle = state.editMask ? '#ffffff' : state.color;
  }

  _dab(point, tool, pressure) {
    const ctx = this.stroke.getContext('2d');
    ctx.save(); this._style(ctx, tool, pressure);
    ctx.beginPath(); ctx.arc(point.x, point.y, state.brushSize / 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const r = Math.ceil(state.brushSize / 2) + 2;
    this._applyStroke({ x: Math.floor(point.x - r), y: Math.floor(point.y - r), w: Math.ceil(r * 2), h: Math.ceil(r * 2) });
  }

  _segment(from, to, tool, pressure) {
    const ctx = this.stroke.getContext('2d');
    ctx.save(); this._style(ctx, tool, pressure);
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke(); ctx.restore();
    const r = Math.ceil(state.brushSize / 2) + 2;
    const x = Math.floor(Math.min(from.x, to.x) - r), y = Math.floor(Math.min(from.y, to.y) - r);
    this._applyStroke({ x, y, w: Math.ceil(Math.abs(to.x - from.x) + r * 2), h: Math.ceil(Math.abs(to.y - from.y) + r * 2) });
  }

  _applyStroke(bounds) {
    const doc = this.getDocument();
    const layer = doc?.layers.find(item => item.id === this.startLayerId);
    if (!layer || !bounds) return;
    const x = Math.max(0, Math.floor(bounds.x));
    const y = Math.max(0, Math.floor(bounds.y));
    const right = Math.min(doc.width, Math.ceil(bounds.x + bounds.w));
    const bottom = Math.min(doc.height, Math.ceil(bounds.y + bounds.h));
    const width = right - x, height = bottom - y;
    if (width < 1 || height < 1) return;

    // Build only the newly touched patch. Clearing it after application prevents
    // old dabs from being composited again on every pointer-move event.
    const patch = makeCanvas(width, height);
    const pctx = patch.getContext('2d');
    pctx.drawImage(this.stroke, x, y, width, height, 0, 0, width, height);
    const selection = this.getSelection();
    if (selection) {
      const localSelection = selectionToLayerCanvas(selection, layer, doc, makeCanvas);
      pctx.globalCompositeOperation = 'destination-in';
      pctx.drawImage(localSelection, -x, -y);
    }

    const targetCtx = this.target.getContext('2d');
    const darkMaskBrush = state.editMask && /^#[0-9a-f]{6}$/i.test(state.color) && Number.parseInt(state.color.slice(1), 16) < 0x404040;
    const erase = state.tool === 'eraser' || darkMaskBrush;
    targetCtx.save();
    targetCtx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    targetCtx.drawImage(patch, x, y);
    targetCtx.restore();
    this.stroke.getContext('2d').clearRect(x, y, width, height);
  }

  end() {
    if (!this.active) return false;
    const tiles = [...this.beforeTiles.values()];
    this.recordStroke?.(this.startLayerId, this.targetKind, tiles, state.tool === 'eraser' ? 'Borracha' : 'Pincel');
    this.beforeTiles.clear();
    this.active = false; this.last = null; this.stroke = null; this.target = null;
    this.commit('Traço finalizado');
    return true;
  }
}
