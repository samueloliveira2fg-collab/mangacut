import { state, makeCanvas } from '../core/state.js';
import { getActiveRaster } from '../core/document.js';
import { documentToLayerInputPoint, selectionToLayerCanvas } from '../core/transforms.js';

// Clone Stamp samples from the active raster layer using a fixed source offset.
export class CloneController {
  constructor({ getDocument, getSelection, checkpoint, commit, render, notify }) {
    Object.assign(this, { getDocument, getSelection, checkpoint, commit, render, notify });
    this.source = null; this.active = false; this.target = null; this.last = null; this.offset = null;
  }
  setSource(point) {
    const layer = getActiveRaster(this.getDocument());
    if (!layer) return this.notify('Selecione uma camada raster para definir a origem.');
    const mapped = documentToLayerInputPoint(point, layer, this.getDocument());
    this.source = { x: mapped.x - layer.x, y: mapped.y - layer.y };
    this.notify(`Origem do carimbo definida: ${Math.round(point.x)}, ${Math.round(point.y)}. Agora pinte para clonar.`);
  }
  begin(point) {
    const doc = this.getDocument(), layer = getActiveRaster(doc);
    if (!layer || layer.locked) return this.notify('Selecione uma camada raster desbloqueada.');
    if (!this.source) return this.notify('Alt+clique para definir a origem do carimbo.');
    this.checkpoint('Carimbo de clonagem'); this.target = layer.canvas;
    const mapped = documentToLayerInputPoint(point, layer, doc);
    this.offset = { x: this.source.x - (mapped.x - layer.x), y: this.source.y - (mapped.y - layer.y) };
    this.last = { x: mapped.x - layer.x, y: mapped.y - layer.y }; this.active = true;
    this.stamp(this.last); return true;
  }
  stamp(point) {
    const doc=this.getDocument(), layer=getActiveRaster(doc); if(!layer) return;
    const size=Math.max(1,state.brushSize), half=size/2, src=this.target;
    const x=Math.round(point.x-half), y=Math.round(point.y-half);
    const sx=Math.round(point.x+this.offset.x-half), sy=Math.round(point.y+this.offset.y-half);
    const patch=makeCanvas(size,size), pctx=patch.getContext('2d');
    pctx.save(); pctx.beginPath(); pctx.arc(half,half,half,0,Math.PI*2); pctx.clip();
    pctx.drawImage(src,sx,sy,size,size,0,0,size,size); pctx.restore();
    const ctx=this.target.getContext('2d'); ctx.save(); ctx.globalAlpha=state.brushOpacity;
    const selection=this.getSelection();
    if(selection){
      const localSelection=selectionToLayerCanvas(selection,layer,doc,makeCanvas);
      const mask=makeCanvas(size,size); mask.getContext('2d').drawImage(localSelection,x,y,size,size,0,0,size,size);
      patch.getContext('2d').globalCompositeOperation='destination-in'; patch.getContext('2d').drawImage(mask,0,0);
    }
    ctx.drawImage(patch,x,y); ctx.restore();
  }
  move(point) {
    if(!this.active) return;
    const layer=getActiveRaster(this.getDocument()); if(!layer) return;
    const mapped=documentToLayerInputPoint(point,layer,this.getDocument());
    const p={x:mapped.x-layer.x,y:mapped.y-layer.y};
    const dx=p.x-this.last.x,dy=p.y-this.last.y,dist=Math.hypot(dx,dy),step=Math.max(1,state.brushSize*.18);
    for(let d=step;d<dist;d+=step) this.stamp({x:this.last.x+dx*d/dist,y:this.last.y+dy*d/dist});
    this.stamp(p); this.last=p; this.render();
  }
  end(){if(!this.active)return;this.active=false;this.target=null;this.last=null;this.commit('Carimbo de clonagem');}
}
