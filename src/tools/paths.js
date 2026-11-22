const finite = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} precisa ser um número finito.`);
  return number;
};

function point(value, label = 'ponto') {
  if (!value || typeof value !== 'object') throw new TypeError(`${label} inválido.`);
  return { x: finite(value.x, `${label}.x`), y: finite(value.y, `${label}.y`) };
}

export function createPath({ id = `path-${Date.now()}`, name = 'Caminho', closed = false, segments = [] } = {}) {
  if (!Array.isArray(segments)) throw new TypeError('segments precisa ser uma lista.');
  return {
    id: String(id), name: String(name), closed: Boolean(closed),
    segments: segments.map((segment, index) => ({
      anchor: point(segment.anchor, `segmento ${index + 1} âncora`),
      in: segment.in ? point(segment.in, `segmento ${index + 1} alça de entrada`) : null,
      out: segment.out ? point(segment.out, `segmento ${index + 1} alça de saída`) : null,
      smooth: Boolean(segment.smooth)
    }))
  };
}

export function addAnchor(path, anchor, handles = {}) {
  const next = createPath(path);
  next.segments.push({
    anchor: point(anchor),
    in: handles.in ? point(handles.in) : null,
    out: handles.out ? point(handles.out) : null,
    smooth: Boolean(handles.smooth)
  });
  return next;
}

export function updateAnchor(path, index, patch = {}) {
  const next = createPath(path);
  if (!Number.isInteger(index) || index < 0 || index >= next.segments.length) throw new RangeError('Índice de âncora fora do caminho.');
  const current = next.segments[index];
  next.segments[index] = {
    anchor: patch.anchor ? point(patch.anchor) : current.anchor,
    in: Object.hasOwn(patch, 'in') ? (patch.in ? point(patch.in) : null) : current.in,
    out: Object.hasOwn(patch, 'out') ? (patch.out ? point(patch.out) : null) : current.out,
    smooth: Object.hasOwn(patch, 'smooth') ? Boolean(patch.smooth) : current.smooth
  };
  return next;
}

export function samplePath(path, stepsPerSegment = 16) {
  const steps = Math.max(2, Math.min(256, Math.floor(finite(stepsPerSegment, 'stepsPerSegment'))));
  const segments = path?.segments ?? [];
  if (segments.length < 2) return segments.map(segment => point(segment.anchor));
  const count = path.closed ? segments.length : segments.length - 1;
  const output = [];
  for (let i = 0; i < count; i++) {
    const a = segments[i];
    const b = segments[(i + 1) % segments.length];
    const p0 = point(a.anchor), p3 = point(b.anchor);
    const p1 = a.out ? point(a.out) : p0;
    const p2 = b.in ? point(b.in) : p3;
    for (let step = 0; step < steps; step++) {
      const t = step / steps, u = 1 - t;
      output.push({
        x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
        y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y
      });
    }
  }
  output.push(point(segments[segments.length - 1].anchor));
  return output;
}

export function pathToSvg(path, { precision = 3 } = {}) {
  const p = createPath(path);
  if (!p.segments.length) return '';
  const fmt = n => Number(n.toFixed(Math.max(0, Math.min(8, precision)))).toString();
  const first = p.segments[0];
  let d = `M ${fmt(first.anchor.x)} ${fmt(first.anchor.y)}`;
  const count = p.closed ? p.segments.length : p.segments.length - 1;
  for (let i = 0; i < count; i++) {
    const a = p.segments[i], b = p.segments[(i + 1) % p.segments.length];
    if (a.out || b.in) {
      const c1 = a.out ?? a.anchor, c2 = b.in ?? b.anchor;
      d += ` C ${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(b.anchor.x)} ${fmt(b.anchor.y)}`;
    } else d += ` L ${fmt(b.anchor.x)} ${fmt(b.anchor.y)}`;
  }
  if (p.closed) d += ' Z';
  return d;
}

export function exportPathsSvg(paths, { width, height, stroke = '#00a8ff', strokeWidth = 1, fill = 'none' } = {}) {
  const w = finite(width, 'width'), h = finite(height, 'height');
  if (w <= 0 || h <= 0) throw new RangeError('Dimensões SVG precisam ser positivas.');
  const body = paths.map(path => {
    const d = pathToSvg(path).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
    return d ? `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${finite(strokeWidth, 'strokeWidth')}"/>` : '';
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}
