import { makeCanvas } from '../core/state.js';

export const COMPOSITE_TILE_SIZE = 256;

export function compositeTileRects(width, height, tileSize = COMPOSITE_TILE_SIZE) {
  const rects = [];
  for (let y = 0; y < height; y += tileSize) for (let x = 0; x < width; x += tileSize)
    rects.push({ x, y, width: Math.min(tileSize, width - x), height: Math.min(tileSize, height - y) });
  return rects;
}

function drawRaster(ctx, layer, docWidth, docHeight, offsetX, offsetY, tileWidth, tileHeight) {
  const sx = Number(layer.scaleX ?? 1), sy = Number(layer.scaleY ?? 1);
  const rotation = Number(layer.rotation ?? 0) * Math.PI / 180;
  const transformed = sx !== 1 || sy !== 1 || rotation !== 0;
  const drawAtTile = (targetCtx, source) => {
    if (transformed) {
      targetCtx.translate(docWidth / 2 - offsetX, docHeight / 2 - offsetY);
      targetCtx.rotate(rotation); targetCtx.scale(sx, sy);
      targetCtx.drawImage(source, (layer.x || 0) - docWidth / 2, (layer.y || 0) - docHeight / 2);
    } else {
      targetCtx.drawImage(source, (layer.x || 0) - offsetX, (layer.y || 0) - offsetY);
    }
  };
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, Number(layer.opacity ?? 1)));
  ctx.globalCompositeOperation = layer.blend || 'source-over';
  if (layer.mask) {
    // The mask is applied on a tile-sized temporary surface, not a full-document
    // canvas, so masked layers do not allocate a full-size surface for every tile.
    const maskedTile = makeCanvas(tileWidth, tileHeight);
    const mctx = maskedTile.getContext('2d');
    mctx.save(); drawAtTile(mctx, layer.canvas); mctx.restore();
    mctx.save(); mctx.globalCompositeOperation = 'destination-in'; drawAtTile(mctx, layer.mask); mctx.restore();
    ctx.drawImage(maskedTile, 0, 0);
  } else {
    drawAtTile(ctx, layer.canvas);
  }
  ctx.restore();
}

function drawText(ctx, node, width, docWidth, docHeight, offsetX, offsetY) {
  const sx = Number(node.scaleX ?? 1), sy = Number(node.scaleY ?? 1);
  const rotation = Number(node.rotation ?? 0) * Math.PI / 180;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, Number(node.opacity ?? 1)));
  ctx.globalCompositeOperation = node.blend || 'source-over';
  ctx.translate(Number(node.x || 0) - offsetX, Number(node.y || 0) - offsetY);
  ctx.rotate(rotation); ctx.scale(sx, sy);
  ctx.fillStyle = node.color || '#111111';
  ctx.font = `${node.fontStyle || 'normal'} ${node.fontWeight || 'normal'} ${Math.max(1, Number(node.fontSize || 48))}px ${node.fontFamily || 'Arial'}`;
  ctx.textAlign = node.textAlign || 'left'; ctx.textBaseline = 'top';
  const lines = String(node.text || '').split('\n');
  const lineHeight = Math.max(1, Number(node.fontSize || 48)) * 1.2;
  lines.forEach((line, index) => ctx.fillText(line, 0, index * lineHeight, docWidth * 4));
  ctx.restore();
}

function applyAdjustment(ctx, node, width, height) {
  const opacity = Math.max(0, Math.min(1, Number(node.opacity ?? 1)));
  if (!opacity) return;
  const image = ctx.getImageData(0, 0, width, height), data = image.data;
  const params = node.params || {};
  const brightness = Math.max(-100, Math.min(100, Number(params.brightness || 0))) * 2.55;
  const contrast = Math.max(-100, Math.min(100, Number(params.contrast || 0)));
  const saturation = Math.max(-100, Math.min(100, Number(params.saturation || 0)));
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < data.length; i += 4) {
    const oldR = data[i], oldG = data[i + 1], oldB = data[i + 2];
    let r = oldR, g = oldG, b = oldB;
    if (node.kind === 'invert') { r = 255-r; g = 255-g; b = 255-b; }
    else if (node.kind === 'grayscale') { const y=.2126*r+.7152*g+.0722*b; r=g=b=y; }
    else if (node.kind === 'sepia') { const nr=.393*r+.769*g+.189*b, ng=.349*r+.686*g+.168*b, nb=.272*r+.534*g+.131*b; r=nr; g=ng; b=nb; }
    else if (node.kind === 'threshold') { const y=.2126*r+.7152*g+.0722*b, v=y>=Number(params.threshold??128)?255:0; r=g=b=v; }
    else if (node.kind === 'posterize') { const levels=Math.max(2,Math.min(16,Number(params.levels??4))),q=255/(levels-1); r=Math.round(r/q)*q; g=Math.round(g/q)*q; b=Math.round(b/q)*q; }
    else {
      r=factor*(r-128)+128+brightness; g=factor*(g-128)+128+brightness; b=factor*(b-128)+128+brightness;
      if(saturation!==0){const y=.2126*r+.7152*g+.0722*b,m=1+saturation/100;r=y+(r-y)*m;g=y+(g-y)*m;b=y+(b-y)*m;}
    }
    data[i]=oldR+(Math.max(0,Math.min(255,r))-oldR)*opacity;
    data[i+1]=oldG+(Math.max(0,Math.min(255,g))-oldG)*opacity;
    data[i+2]=oldB+(Math.max(0,Math.min(255,b))-oldB)*opacity;
  }
  ctx.putImageData(image,0,0);
}

function renderChildren(ctx, nodes, parentId, docWidth, docHeight, offsetX, offsetY, tileWidth, tileHeight) {
  const children = nodes.filter(node => (node.parentId ?? null) === (parentId ?? null));
  for (const node of children) {
    if (!node.visible) continue;
    if (node.type === 'group') {
      const opacity = Math.max(0, Math.min(1, Number(node.opacity ?? 1)));
      if (node.passThrough && opacity === 1 && (node.blend || 'source-over') === 'source-over') {
        renderChildren(ctx, nodes, node.id, docWidth, docHeight, offsetX, offsetY, tileWidth, tileHeight);
      } else {
        const groupCanvas = makeCanvas(tileWidth, tileHeight);
        renderChildren(groupCanvas.getContext('2d'), nodes, node.id, docWidth, docHeight, offsetX, offsetY, tileWidth, tileHeight);
        ctx.save(); ctx.globalAlpha=opacity; ctx.globalCompositeOperation=node.blend||'source-over'; ctx.drawImage(groupCanvas,0,0); ctx.restore();
      }
    } else if (node.type === 'adjustment') {
      applyAdjustment(ctx,node,tileWidth,tileHeight);
    } else if (node.type === 'text') {
      drawText(ctx,node,docWidth,docWidth,docHeight,offsetX,offsetY);
    } else {
      drawRaster(ctx,node,docWidth,docHeight,offsetX,offsetY,tileWidth,tileHeight);
    }
  }
}

// Full recomposition is performed one 256px region at a time. The document
// still owns full-resolution layer canvases, but temporary compositing surfaces
// are bounded to a single tile (including masked layers and isolated groups).
export function compositeDocument(doc, targetCanvas) {
  if (!doc || !targetCanvas) return;
  if (targetCanvas.width !== doc.width) targetCanvas.width = doc.width;
  if (targetCanvas.height !== doc.height) targetCanvas.height = doc.height;
  const target = targetCanvas.getContext('2d');
  target.clearRect(0,0,doc.width,doc.height);
  for (const rect of compositeTileRects(doc.width, doc.height)) {
    const tile = makeCanvas(rect.width, rect.height);
    renderChildren(tile.getContext('2d'), doc.layers, null, doc.width, doc.height, rect.x, rect.y, rect.width, rect.height);
    target.drawImage(tile, rect.x, rect.y);
  }
}
