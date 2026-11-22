import { state } from '../core/state.js';
import { activeNode } from '../core/document.js';

function pixelFilter(doc, transform, label, checkpoint, render, commit, notify) {
  const layer = activeNode(doc);
  if (!layer || layer.type !== 'raster') return notify('Selecione uma camada raster.');
  if (layer.locked) return notify('Esta camada está bloqueada.');
  checkpoint(label);
  const ctx = layer.canvas.getContext('2d', { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
  transform(image.data);
  ctx.putImageData(image, 0, 0);
  render(); commit(label);
}

export function applyFilter(name, ctx) {
  const { doc, checkpoint, render, commit, notify } = ctx;
  if (!doc) return notify('Abra ou crie um documento primeiro.');
  if (name === 'grayscale') return pixelFilter(doc, data => {
    for (let i = 0; i < data.length; i += 4) { const y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; data[i] = data[i + 1] = data[i + 2] = y; }
  }, 'Escala de cinza', checkpoint, render, commit, notify);
  if (name === 'invert') return pixelFilter(doc, data => { for (let i = 0; i < data.length; i += 4) { data[i] = 255 - data[i]; data[i + 1] = 255 - data[i + 1]; data[i + 2] = 255 - data[i + 2]; } }, 'Inverter', checkpoint, render, commit, notify);
  if (name === 'brightness') {
    const value = Number(prompt('Brilho: -100 a +100', '15'));
    if (!Number.isFinite(value) || value < -100 || value > 100) return notify('Valor de brilho inválido.');
    return pixelFilter(doc, data => { for (let i = 0; i < data.length; i += 4) { data[i] = Math.max(0, Math.min(255, data[i] + value * 2.55)); data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + value * 2.55)); data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + value * 2.55)); } }, 'Brilho', checkpoint, render, commit, notify);
  }
  if (name === 'blur') {
    const layer = activeNode(doc);
    if (!layer || layer.type !== 'raster') return notify('Selecione uma camada raster.');
    checkpoint('Desfoque gaussiano aproximado');
    const c = document.createElement('canvas'); c.width = layer.canvas.width; c.height = layer.canvas.height;
    const x = c.getContext('2d'); x.filter = 'blur(3px)'; x.drawImage(layer.canvas, 0, 0);
    layer.canvas.getContext('2d').clearRect(0, 0, c.width, c.height); layer.canvas.getContext('2d').drawImage(c, 0, 0);
    render(); commit('Desfoque');
  }
}
