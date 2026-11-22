import { state, makeCanvas } from '../core/state.js';
import { getActiveRaster } from '../core/document.js';
import { documentToLayerInputPoint, selectionToLayerCanvas } from '../core/transforms.js';

const MAX_HEAL_PIXELS = 12_000_000;

const clamp8 = value => Math.max(0, Math.min(255, Math.round(value)));
const smoothstep = (a, b, value) => {
  const t = Math.max(0, Math.min(1, (value - a) / Math.max(1e-6, b - a)));
  return t * t * (3 - 2 * t);
};

// Local patch healing: transfers source texture while matching its average RGB
// to the destination neighborhood and feathering the circular brush boundary.
export function healPixelPatch(destination, source, width, height, { radius, selection = null, strength = 0.85, feather = 0.28, opacity = 1, centerX = (width - 1) / 2, centerY = (height - 1) / 2 } = {}) {
  if (destination.length !== source.length || destination.length !== width * height * 4) throw new Error('Buffers do retoque inválidos.');
  const out = new Uint8ClampedArray(destination);
  const cx = Number(centerX), cy = Number(centerY);
  const r = Math.max(1, Number(radius) || Math.min(width, height) / 2);
  const inner = r * (1 - Math.max(0.05, Math.min(0.8, feather)));
  let sr = 0, sg = 0, sb = 0, dr = 0, dg = 0, db = 0, count = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (Math.hypot(x - cx, y - cy) > inner) continue;
    const i = (y * width + x) * 4;
    if (source[i + 3] < 8 || destination[i + 3] < 8) continue;
    sr += source[i]; sg += source[i + 1]; sb += source[i + 2];
    dr += destination[i]; dg += destination[i + 1]; db += destination[i + 2]; count++;
  }
  if (!count) return out;
  const correction = [((dr - sr) / count) * strength, ((dg - sg) / count) * strength, ((db - sb) / count) * strength];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const distance = Math.hypot(x - cx, y - cy);
    if (distance > r) continue;
    const i = (y * width + x) * 4;
    const edge = 1 - smoothstep(inner, r, distance);
    const selected = selection ? selection[i + 3] / 255 : 1;
    const amount = edge * selected * Math.max(0, Math.min(1, Number(opacity) || 0));
    if (amount <= 0 || source[i + 3] === 0) continue;
    for (let channel = 0; channel < 3; channel++) {
      const healed = clamp8(source[i + channel] + correction[channel]);
      out[i + channel] = clamp8(destination[i + channel] * (1 - amount) + healed * amount);
    }
    out[i + 3] = clamp8(destination[i + 3] * (1 - amount) + source[i + 3] * amount);
  }
  return out;
}

export class HealingController {
  constructor({ getDocument, getSelection, recordStroke, commit, render, notify }) {
    Object.assign(this, { getDocument, getSelection, recordStroke, commit, render, notify });
    this.active = false; this.source = null; this.snapshot = null; this.target = null;
    this.layerId = null; this.offset = null; this.last = null; this.beforeTiles = new Map();
  }
  setSource(point) {
    const layer = getActiveRaster(this.getDocument());
    if (!layer) return this.notify('Selecione uma camada raster para definir a origem do Healing.');
    if (layer.canvas.width * layer.canvas.height > MAX_HEAL_PIXELS) return this.notify('Healing limitado a 12 megapixels por camada nesta versão para proteger a memória.');
    const mapped = documentToLayerInputPoint(point, layer, this.getDocument());
    this.source = { x: mapped.x - layer.x, y: mapped.y - layer.y };
    this.notify(`Origem do Healing definida em ${Math.round(point.x)}, ${Math.round(point.y)}.`);
  }
  begin(point) {
    const doc=this.getDocument(), layer=getActiveRaster(doc);
    if(!layer || layer.locked) return this.notify('Selecione uma camada raster desbloqueada.');
    if(!this.source) return this.notify('Alt+clique para definir a origem do Healing.');
    if(layer.canvas.width*layer.canvas.height>MAX_HEAL_PIXELS) return this.notify('Healing limitado a 12 megapixels por camada nesta versão.');
    this.snapshot=makeCanvas(layer.canvas.width,layer.canvas.height);
    this.snapshot.getContext('2d').drawImage(layer.canvas,0,0);
    this.target=layer.canvas; this.layerId=layer.id;
    const mapped=documentToLayerInputPoint(point,layer,doc);
    this.offset={x:this.source.x-(mapped.x-layer.x),y:this.source.y-(mapped.y-layer.y)};
    this.last={x:mapped.x-layer.x,y:mapped.y-layer.y};
    this.beforeTiles.clear(); this.active=true; this.stamp(this.last); return true;
  }
  capture(x,y,w,h,canvasWidth,canvasHeight){
    const ctx=this.target.getContext('2d',{willReadFrequently:true});
    const size=256,x0=Math.max(0,Math.floor(x/size)),y0=Math.max(0,Math.floor(y/size));
    const x1=Math.floor(Math.max(0,Math.min(canvasWidth-1,x+w-1))/size),y1=Math.floor(Math.max(0,Math.min(canvasHeight-1,y+h-1))/size);
    for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){
      const tx0=tx*size,ty0=ty*size,tw=Math.min(size,canvasWidth-tx0),th=Math.min(size,canvasHeight-ty0),key=`${tx}:${ty}`;
      if(tw>0&&th>0&&!this.beforeTiles.has(key)) this.beforeTiles.set(key,{x:tx0,y:ty0,width:tw,height:th,before:new Uint8ClampedArray(ctx.getImageData(tx0,ty0,tw,th).data)});
    }
  }
  stamp(point){
    const layer=this.getDocument().layers.find(n=>n.id===this.layerId); if(!layer)return;
    const size=Math.max(4,Math.round(state.brushSize)),half=size/2;
    const lx=Math.round(point.x-half),ly=Math.round(point.y-half);
    const x=Math.max(0,lx),y=Math.max(0,ly),right=Math.min(this.target.width,lx+size),bottom=Math.min(this.target.height,ly+size);
    const w=right-x,h=bottom-y;if(w<1||h<1)return;
    const selection=this.getSelection();
    const localSelection=selection ? selectionToLayerCanvas(selection,layer,this.getDocument(),makeCanvas) : null;
    const targetCtx=this.target.getContext('2d',{willReadFrequently:true});
    this.capture(x,y,w,h,this.target.width,this.target.height);
    const dest=targetCtx.getImageData(x,y,w,h);
    const sourceCanvas=makeCanvas(w,h);
    sourceCanvas.getContext('2d').drawImage(this.snapshot,x+this.offset.x,y+this.offset.y,w,h,0,0,w,h);
    const src=sourceCanvas.getContext('2d').getImageData(0,0,w,h);
    let selectionData=null;
    if(localSelection) selectionData=localSelection.getContext('2d',{willReadFrequently:true}).getImageData(x,y,w,h);
    const selectionPixels=selectionData?.data || null;
    const patched=healPixelPatch(dest.data,src.data,w,h,{radius:size/2,centerX:lx+half-x,centerY:ly+half-y,strength:0.88,feather:0.32,opacity:state.brushOpacity,selection:selectionPixels});
    dest.data.set(patched); targetCtx.putImageData(dest,x,y);
  }
  move(point){
    if(!this.active)return;
    const doc=this.getDocument(), layer=doc.layers.find(n=>n.id===this.layerId);if(!layer)return;
    const mapped=documentToLayerInputPoint(point,layer,doc);
    const p={x:mapped.x-layer.x,y:mapped.y-layer.y},dx=p.x-this.last.x,dy=p.y-this.last.y;
    const dist=Math.hypot(dx,dy),step=Math.max(2,state.brushSize*.22);
    for(let d=step;d<dist;d+=step)this.stamp({x:this.last.x+dx*d/dist,y:this.last.y+dy*d/dist});
    this.stamp(p);this.last=p;this.render();
  }
  end(){
    if(!this.active)return;
    this.recordStroke?.(this.layerId,'canvas',[...this.beforeTiles.values()],'Healing');
    this.beforeTiles.clear();this.active=false;this.snapshot=null;this.target=null;this.last=null;
    this.commit('Healing finalizado');
  }
}
