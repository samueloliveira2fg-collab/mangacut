// Bounded LRU cache and tile iterator foundation for the future tiled compositor.
// The current document compositor still renders full-frame Canvas 2D.
export const TILE_SIZE = 256;
export function tileRange(width, height, tileSize = TILE_SIZE) {
  const tiles=[];
  for(let y=0;y<height;y+=tileSize) for(let x=0;x<width;x+=tileSize)
    tiles.push({x,y,width:Math.min(tileSize,width-x),height:Math.min(tileSize,height-y),key:`${x}:${y}:${tileSize}`});
  return tiles;
}
export class TileLRU {
  constructor(maxBytes=64*1024*1024){this.maxBytes=maxBytes;this.bytes=0;this.items=new Map();}
  get(key){const item=this.items.get(key);if(!item)return null;this.items.delete(key);this.items.set(key,item);return item.value;}
  set(key,value,bytes=value?.width*value?.height*4||0){if(this.items.has(key)){this.bytes-=this.items.get(key).bytes;this.items.delete(key);}this.items.set(key,{value,bytes});this.bytes+=bytes;while(this.bytes>this.maxBytes&&this.items.size){const first=this.items.keys().next().value;this.bytes-=this.items.get(first).bytes;this.items.delete(first);}}
  clear(){this.items.clear();this.bytes=0;}
}
