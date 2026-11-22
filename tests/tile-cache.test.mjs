import test from 'node:test';
import assert from 'node:assert/strict';
import { tileRange, TileLRU } from '../src/render/tile-cache.js';
import { compositeTileRects } from '../src/render/compositor.js';

test('tileRange cobre documento sem ultrapassar bordas',()=>{
 const tiles=tileRange(600,500); assert.equal(tiles.length,6);
 assert.deepEqual(tiles.at(-1),{x:512,y:256,width:88,height:244,key:'512:256:256'});
 assert.equal(tiles.reduce((n,t)=>n+t.width*t.height,0),600*500);
});
test('TileLRU remove entradas antigas até respeitar orçamento',()=>{
 const cache=new TileLRU(100); cache.set('a',{width:5,height:5},100); cache.set('b',{width:5,height:5},100);
 assert.equal(cache.get('a'),null); assert.ok(cache.get('b')); assert.equal(cache.bytes,100);
});

test('compositor divides the full frame into bounded 256px surfaces',()=>{
 const tiles=compositeTileRects(600,500);
 assert.equal(tiles.length,6);
 assert.deepEqual(tiles.at(-1),{x:512,y:256,width:88,height:244});
 assert.equal(tiles.reduce((sum,t)=>sum+t.width*t.height,0),600*500);
 assert.ok(tiles.every(t=>t.width<=256&&t.height<=256));
});
