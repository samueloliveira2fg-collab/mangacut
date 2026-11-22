/** Convert a document-space pointer into the untransformed raster canvas space.
 * The compositor applies translate(docCenter) -> rotate -> scale -> draw at
 * (layer.x-docCenter). Controllers historically subtract layer.x themselves,
 * so this function returns localX+layer.x/localY+layer.y for compatibility.
 */
export function documentToLayerInputPoint(point, layer, doc) {
  if (!point || !layer || !doc) throw new TypeError('Ponto, camada e documento são obrigatórios.');
  const sx = Number(layer.scaleX ?? 1), sy = Number(layer.scaleY ?? 1);
  if (!Number.isFinite(sx) || !Number.isFinite(sy) || Math.abs(sx) < 1e-8 || Math.abs(sy) < 1e-8) {
    throw new RangeError('A transformação da camada possui escala inválida ou zero.');
  }
  const angle = Number(layer.rotation ?? 0) * Math.PI / 180;
  if (!Number.isFinite(angle)) throw new RangeError('Rotação da camada inválida.');
  const cx = doc.width / 2, cy = doc.height / 2;
  const dx = Number(point.x) - cx, dy = Number(point.y) - cy;
  const c = Math.cos(angle), s = Math.sin(angle);
  // R^-1 followed by S^-1, matching the Canvas 2D compositor transform order.
  const rx = c * dx + s * dy;
  const ry = -s * dx + c * dy;
  return { x: rx / sx + cx, y: ry / sy + cy };
}

export function layerToDocumentPoint(localPoint, layer, doc) {
  const sx = Number(layer.scaleX ?? 1), sy = Number(layer.scaleY ?? 1);
  const angle = Number(layer.rotation ?? 0) * Math.PI / 180;
  const x = Number(localPoint.x) + Number(layer.x || 0) - doc.width / 2;
  const y = Number(localPoint.y) + Number(layer.y || 0) - doc.height / 2;
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: doc.width / 2 + c * sx * x - s * sy * y, y: doc.height / 2 + s * sx * x + c * sy * y };
}

/** Rasterize a document-space selection into the active layer's untransformed pixel space. */
export function selectionToLayerCanvas(selection, layer, doc, makeCanvas) {
  if (!selection) return null;
  if (!layer || !doc || typeof makeCanvas !== 'function') throw new TypeError('Seleção, camada, documento e fábrica de canvas são obrigatórios.');
  const output = makeCanvas(layer.canvas?.width || doc.width, layer.canvas?.height || doc.height);
  const sx = Number(layer.scaleX ?? 1), sy = Number(layer.scaleY ?? 1);
  if (!Number.isFinite(sx) || !Number.isFinite(sy) || Math.abs(sx) < 1e-8 || Math.abs(sy) < 1e-8) {
    throw new RangeError('A transformação da camada possui escala inválida ou zero.');
  }
  const angle = Number(layer.rotation ?? 0) * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle), cx = doc.width / 2, cy = doc.height / 2;
  const a = c / sx, b = -s / sy, cc = s / sx, d = c / sy;
  const e = cx - a * cx - cc * cy - Number(layer.x || 0);
  const f = cy - b * cx - d * cy - Number(layer.y || 0);
  const ctx = output.getContext('2d');
  ctx.setTransform(a, b, cc, d, e, f);
  ctx.drawImage(selection, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return output;
}
