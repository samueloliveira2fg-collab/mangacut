import test from 'node:test';
import assert from 'node:assert/strict';
import { healPixelPatch } from '../src/tools/healing.js';

test('healing transfers source texture with local color matching', () => {
  const width=5,height=5;
  const destination=new Uint8ClampedArray(width*height*4);
  const source=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<destination.length;i+=4){destination[i]=100;destination[i+1]=90;destination[i+2]=80;destination[i+3]=255;source[i]=200;source[i+1]=190;source[i+2]=180;source[i+3]=255;}
  const healed=healPixelPatch(destination,source,width,height,{radius:2,strength:.85,feather:.25});
  const center=(2*width+2)*4;
  assert.deepEqual([...healed.slice(center,center+4)],[115,105,95,255]);
  const corner=0;
  assert.deepEqual([...healed.slice(corner,corner+4)],[100,90,80,255]);
});

test('healing respects selection alpha and leaves unselected pixels unchanged', () => {
  const destination=new Uint8ClampedArray(3*3*4),source=new Uint8ClampedArray(3*3*4),selection=new Uint8ClampedArray(3*3*4);
  for(let i=0;i<destination.length;i+=4){destination.set([40,50,60,255],i);source.set([220,210,200,255],i);}
  selection.set([255,255,255,0],(1*3+1)*4);
  const result=healPixelPatch(destination,source,3,3,{radius:2,selection});
  assert.deepEqual([...result.slice(0,4)],[40,50,60,255]);
});

test('healing opacity blends rather than replacing the destination patch', () => {
  const dst=new Uint8ClampedArray(3*3*4),src=new Uint8ClampedArray(3*3*4);
  for(let i=0;i<dst.length;i+=4){dst.set([50,50,50,255],i);src.set([150,150,150,255],i);}
  const out=healPixelPatch(dst,src,3,3,{radius:2,opacity:.5});
  const center=(1*3+1)*4;
  assert.deepEqual([...out.slice(center,center+4)],[58,58,58,255]);
});
