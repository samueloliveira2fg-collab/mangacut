import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePsd, encodeLayeredPsd, parsePsd, estimatePsdDecodeMemory } from '../src/io/psd.js';

class FakeCanvas {
  constructor() { this.width = 0; this.height = 0; this.pixels = null; this.ctx = {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: (image) => { this.width = image.width; this.height = image.height; this.pixels = new Uint8ClampedArray(image.data); },
    getImageData: (_x, _y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(this.pixels || w * h * 4) }),
    drawImage: () => {}, clearRect: () => {}, setTransform: () => {}, save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {}, scale: () => {}, fillText: () => {}, measureText: text => ({ width: String(text).length * 10 })
  }; }
  getContext() { return this.ctx; }
}
if (!globalThis.document) globalThis.document = { createElement: () => new FakeCanvas() };
if (!globalThis.ImageData) globalThis.ImageData = class { constructor(data, width, height) { this.data = data; this.width = width; this.height = height; } };

function makeHeader({ psb = false, width = 2, height = 1, channels = 4, compression = 0, colorMode = 3 } = {}) {
  const bytes = new Uint8Array(26 + 4 + 4 + (psb ? 8 : 4) + 2);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('8BPS'), 0);
  view.setUint16(4, psb ? 2 : 1, false);
  view.setUint16(12, channels, false);
  view.setUint32(14, height, false); view.setUint32(18, width, false);
  view.setUint16(22, 8, false); view.setUint16(24, colorMode, false);
  view.setUint32(26, 0, false); view.setUint32(30, 0, false);
  if (psb) view.setBigUint64(34, 0n, false); else view.setUint32(34, 0, false);
  view.setUint16(38 + (psb ? 4 : 0), compression, false);
  return bytes;
}


test('estimativa PSD aceita acima de 40 MP quando cabe no orçamento e rejeita excesso de memória', () => {
  assert.equal(estimatePsdDecodeMemory(10_250, 4_000, 4), 328_000_000);
  assert.ok(estimatePsdDecodeMemory(17_500, 4_000, 4) > 512_000_000);
  assert.equal(estimatePsdDecodeMemory(0, 4_000, 4), Infinity);
});

test('parser PSD não aplica mais o antigo bloqueio fixo de 40 MP', async () => {
  const header = makeHeader({ width: 8_200, height: 5_000, channels: 1, colorMode: 1 });
  await assert.rejects(() => parsePsd(header.buffer), /truncado|inválido/);
});


test('parser PSD interrompe dimensões que excedem o orçamento antes de ler os pixels', async () => {
  const header = makeHeader({ width: 10_000, height: 10_000, channels: 4 });
  await assert.rejects(() => parsePsd(header.buffer), /orçamento de 512 MiB/);
});

test('PSD export writes a valid flattened RGB+alpha PSD and parses back', async () => {
  const imageData = { width: 2, height: 1, data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 128]) };
  const bytes = encodePsd(imageData);
  const parsed = await parsePsd(bytes.buffer);
  assert.equal(parsed.version, 1);
  assert.equal(parsed.flattened, true);
  assert.deepEqual([...parsed.rgba], [...imageData.data]);
});

test('PSB export uses version 2 and 64-bit layer section length', async () => {
  const imageData = { width: 1, height: 1, data: new Uint8ClampedArray([12, 34, 56, 78]) };
  const bytes = encodePsd(imageData, { psb: true });
  const parsed = await parsePsd(bytes.buffer);
  assert.equal(parsed.version, 2);
  assert.deepEqual([...parsed.rgba], [...imageData.data]);
});

test('PSD RLE composite rows decode correctly', async () => {
  const header = makeHeader({ width: 2, height: 1, channels: 3, compression: 1 });
  const rows = [Uint8Array.from([1, 2]), Uint8Array.from([3, 4]), Uint8Array.from([5, 6])];
  const tail = new Uint8Array(3 * 2 + 3 * 3);
  const view = new DataView(tail.buffer);
  let o = 0;
  for (let i = 0; i < 3; i++) { view.setUint16(o, 3, false); o += 2; }
  for (const row of rows) { tail.set([1, ...row], o); o += 3; }
  const bytes = new Uint8Array(header.length + tail.length); bytes.set(header); bytes.set(tail, header.length);
  const parsed = await parsePsd(bytes.buffer);
  assert.deepEqual([...parsed.rgba], [1, 3, 5, 255, 2, 4, 6, 255]);
});

test('PSD parser rejects unsupported color modes and malformed signatures', async () => {
  const bad = new Uint8Array(40);
  await assert.rejects(() => parsePsd(bad.buffer), /assinatura/);
  const indexed = makeHeader({ colorMode: 2 });
  await assert.rejects(() => parsePsd(indexed.buffer), /RGB ou escala de cinza/);
});

test('PSD ZIP composite data decompresses through browser-compatible stream', async () => {
  const { deflateSync } = await import('node:zlib');
  const header = makeHeader({ width: 1, height: 1, channels: 3, compression: 2 });
  const plane = Uint8Array.from([41, 82, 123]);
  const compressed = deflateSync(plane);
  const bytes = new Uint8Array(header.length + compressed.length);
  bytes.set(header); bytes.set(compressed, header.length);
  const parsed = await parsePsd(bytes.buffer);
  assert.deepEqual([...parsed.rgba], [41, 82, 123, 255]);
});

test('PSD ZIP prediction is reversed for 8-bit rows', async () => {
  const { deflateSync } = await import('node:zlib');
  const header = makeHeader({ width: 3, height: 1, channels: 3, compression: 3 });
  // Planar source values [10,20,30] [40,50,60] [70,80,90] are stored as deltas.
  const predicted = Uint8Array.from([10, 10, 10, 40, 10, 10, 70, 10, 10]);
  const compressed = deflateSync(predicted);
  const bytes = new Uint8Array(header.length + compressed.length);
  bytes.set(header); bytes.set(compressed, header.length);
  const parsed = await parsePsd(bytes.buffer);
  assert.deepEqual([...parsed.rgba], [10, 40, 70, 255, 20, 50, 80, 255, 30, 60, 90, 255]);
});

function be16(value) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, value & 0xffff, false); return b; }
function bei16(value) { const b = new Uint8Array(2); new DataView(b.buffer).setInt16(0, value, false); return b; }
function be32(value) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, value >>> 0, false); return b; }
function bei32(value) { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, value, false); return b; }
function concatBytes(...items) {
  const size = items.reduce((sum, item) => sum + item.length, 0), out = new Uint8Array(size);
  let offset = 0; for (const item of items) { out.set(item, offset); offset += item.length; }
  return out;
}
function block(key, body) { return concatBytes(new TextEncoder().encode('8BIM'), new TextEncoder().encode(key), be32(body.length), body); }
function pascalName(name) {
  const raw = new TextEncoder().encode(name), base = concatBytes(Uint8Array.of(raw.length), raw);
  const pad = (4 - (base.length % 4)) % 4;
  return concatBytes(base, new Uint8Array(pad));
}
function encodeLayerChannel(values, width, height, compression = 0) {
  const raw = Uint8Array.from(values);
  if (compression === 0) return concatBytes(be16(0), raw);
  if (compression === 1) {
    const lengths = [], encodedRows = [];
    for (let y = 0; y < height; y++) {
      const row = raw.subarray(y * width, (y + 1) * width);
      const encoded = concatBytes(Uint8Array.of(row.length - 1), row);
      lengths.push(be16(encoded.length)); encodedRows.push(encoded);
    }
    return concatBytes(be16(1), ...lengths, ...encodedRows);
  }
  throw new Error('compression helper unsupported');
}
function makeLayerRecord({ name, unicodeName = null, x = 0, y = 0, width = 2, height = 1, pixels = null, mask = null, maskBounds = null, maskDefault = 255, maskFlags = 0, opacity = 255, blend = 'norm', clipping = false, flags = 0, sectionType = 0, compression = 0 }) {
  const channels = pixels ? [0, 1, 2, -1].map((id, index) => ({ id, payload: encodeLayerChannel(pixels[index], width, height, compression) })) : [];
  const mb = maskBounds || { x, y, width, height };
  if (mask) channels.push({ id: -2, payload: encodeLayerChannel(mask, mb.width, mb.height, compression) });
  const maskInfo = mask
    ? concatBytes(bei32(mb.y), bei32(mb.x), bei32(mb.y + mb.height), bei32(mb.x + mb.width), Uint8Array.of(maskDefault, maskFlags))
    : new Uint8Array(0);
  const extraParts = [be32(maskInfo.length), maskInfo, be32(0), pascalName(name)];
  if (sectionType) extraParts.push(block('lsct', be32(sectionType)));
  if (unicodeName) {
    const chars = Array.from(unicodeName).map(char => char.charCodeAt(0));
    const utf16 = concatBytes(...chars.map(code => be16(code)));
    extraParts.push(block('luni', concatBytes(be32(chars.length), utf16)));
  }
  const extra = concatBytes(...extraParts);
  const header = concatBytes(
    bei32(y), bei32(x), bei32(y + height), bei32(x + width), be16(channels.length),
    ...channels.map(ch => concatBytes(bei16(ch.id), be32(ch.payload.length))),
    new TextEncoder().encode('8BIM'), new TextEncoder().encode(blend),
    Uint8Array.of(opacity, clipping ? 1 : 0, flags, 0), be32(extra.length), extra
  );
  return { header, channels };
}
function makeLayeredPsd(records, { width = 2, height = 1, colorMode = 3, composite = null, globalMask = new Uint8Array(0), imageResources = new Uint8Array(0) } = {}) {
  const channelCount = colorMode === 3 ? 4 : 2;
  const layerInfo = concatBytes(
    bei16(records.length), ...records.map(record => record.header),
    ...records.flatMap(record => record.channels.map(ch => ch.payload))
  );
  const layerMask = concatBytes(be32(layerInfo.length), layerInfo, be32(globalMask.length), globalMask);
  const header = new Uint8Array(26);
  const view = new DataView(header.buffer);
  header.set(new TextEncoder().encode('8BPS'));
  view.setUint16(4, 1, false); view.setUint16(12, channelCount, false);
  view.setUint32(14, height, false); view.setUint32(18, width, false);
  view.setUint16(22, 8, false); view.setUint16(24, colorMode, false);
  const compositePixels = composite || (colorMode === 3
    ? [240, 240, 240, 255, 240, 240, 240, 255]
    : [240, 255]);
  const planar = colorMode === 3
    ? [0, 1, 2, 3].map(channel => Uint8Array.from({ length: width * height }, (_, p) => compositePixels[p * 4 + channel]))
    : [0, 3].map(channel => Uint8Array.from({ length: width * height }, (_, p) => channel === 0 ? compositePixels[p * 2] : compositePixels[p * 2 + 1]));
  return concatBytes(header, be32(0), be32(imageResources.length), imageResources, be32(layerMask.length), layerMask, be16(0), ...planar);
}

test('PSD em camadas importa rasters mantendo nomes, offsets, opacidade e ordem de composição', async () => {
  const top = makeLayerRecord({
    name: 'Topo', x: 1, y: 0, width: 1, height: 1, opacity: 128,
    pixels: [[0], [0], [255], [128]]
  });
  const bottom = makeLayerRecord({
    name: 'Base', width: 2, height: 1,
    pixels: [[255, 255], [0, 0], [0, 0], [255, 255]]
  });
  const bytes = makeLayeredPsd([top, bottom]);
  const parsed = await parsePsd(bytes.buffer);
  assert.equal(parsed.layered, true);
  assert.equal(parsed.flattened, false);
  assert.deepEqual(parsed.layers.map(layer => layer.name), ['Base', 'Topo']);
  assert.equal(parsed.layers[1].x, 1);
  assert.equal(parsed.layers[1].opacity, 128 / 255);
  assert.deepEqual([...parsed.layers[0].canvas.getContext('2d').getImageData(0, 0, 2, 1).data], [255,0,0,255,255,0,0,255]);
});

test('PSD com grupo sem marcador de fechamento usa o composto por segurança', async () => {
  const group = makeLayerRecord({ name: 'Grupo incompleto', width: 0, height: 0, sectionType: 1, blend: 'pass' });
  const parsed = await parsePsd(makeLayeredPsd([group]).buffer);
  assert.equal(parsed.layered, false);
  assert.match(parsed.warnings.join(' '), /marcadores de grupo.*inconsistentes/i);
});

test('PSD com geometria de máscara ativa de largura zero usa fallback composto', async () => {
  const layer = makeLayerRecord({
    name: 'Máscara inválida', width: 2, height: 1,
    pixels: [[10, 20], [30, 40], [50, 60], [255, 255]],
    mask: [128], maskBounds: { x: 0, y: 0, width: 0, height: 1 }
  });
  const parsed = await parsePsd(makeLayeredPsd([layer]).buffer);
  assert.equal(parsed.layered, false);
  assert.match(parsed.warnings.join(' '), /geometria da máscara.*inválida/i);
});

test('PSD em camadas reconstrói a hierarquia de grupos básicos', async () => {
  const divider = makeLayerRecord({ name: '</Grupo>', width: 0, height: 0, sectionType: 3 });
  const top = makeLayerRecord({ name: 'Superior', pixels: [[0,0],[0,0],[255,255],[255,255]] });
  const bottom = makeLayerRecord({ name: 'Inferior', pixels: [[255,255],[0,0],[0,0],[255,255]] });
  const group = makeLayerRecord({ name: 'Grupo de teste', width: 0, height: 0, sectionType: 1, blend: 'pass' });
  const bytes = makeLayeredPsd([divider, top, bottom, group]);
  const parsed = await parsePsd(bytes.buffer);
  assert.equal(parsed.layered, true);
  const groupNode = parsed.layers.find(layer => layer.type === 'group');
  const children = parsed.layers.filter(layer => layer.parentId === groupNode.id);
  assert.equal(groupNode.name, 'Grupo de teste');
  assert.deepEqual(children.map(layer => layer.name), ['Inferior', 'Superior']);
});


test('PSD em camadas lê canais RLE, máscara raster alinhada e nome Unicode', async () => {
  const layer = makeLayerRecord({
    name: 'Camada', unicodeName: 'Arte 漫画', width: 2, height: 1, compression: 1,
    pixels: [[21, 22], [31, 32], [41, 42], [255, 255]], mask: [255, 0]
  });
  const parsed = await parsePsd(makeLayeredPsd([layer]).buffer);
  assert.equal(parsed.layered, true);
  assert.equal(parsed.layers[0].name, 'Arte 漫画');
  assert.ok(parsed.layers[0].mask);
  assert.deepEqual([...parsed.layers[0].canvas.getContext('2d').getImageData(0, 0, 2, 1).data], [21,31,41,255,22,32,42,255]);
  assert.deepEqual([...parsed.layers[0].mask.getContext('2d').getImageData(0, 0, 2, 1).data], [255,255,255,255,0,0,0,255]);
});


test('PSD importa máscara com retângulo independente e cor padrão fora dos limites', async () => {
  const layer = makeLayerRecord({
    name: 'Mascara parcial', x: 1, y: 0, width: 2, height: 1,
    pixels: [[10, 20], [30, 40], [50, 60], [255, 255]],
    mask: [128], maskBounds: { x: 2, y: 0, width: 1, height: 1 }, maskDefault: 0
  });
  const parsed = await parsePsd(makeLayeredPsd([layer], { width: 3, height: 1 }).buffer);
  assert.equal(parsed.layered, true);
  const mask = parsed.layers[0].mask.getContext('2d').getImageData(0, 0, 2, 1).data;
  assert.deepEqual([...mask], [0,0,0,255,128,128,128,255]);
});

test('PSD respeita máscara posicionada relativamente à camada e opção de inversão', async () => {
  const layer = makeLayerRecord({
    name: 'Mascara relativa', x: 1, y: 0, width: 2, height: 1,
    pixels: [[10, 20], [30, 40], [50, 60], [255, 255]],
    mask: [32], maskBounds: { x: 1, y: 0, width: 1, height: 1 }, maskDefault: 255, maskFlags: 0x05
  });
  const parsed = await parsePsd(makeLayeredPsd([layer], { width: 3, height: 1 }).buffer);
  assert.equal(parsed.layered, true);
  const mask = parsed.layers[0].mask.getContext('2d').getImageData(0, 0, 2, 1).data;
  assert.deepEqual([...mask], [255,255,255,255,223,223,223,255]);
});

test('PSD com máscara global não interpretada usa fallback seguro sem erro interno', async () => {
  const layer = makeLayerRecord({ name: 'Camada', pixels: [[20,20],[30,30],[40,40],[255,255]] });
  const bytes = makeLayeredPsd([layer], { globalMask: Uint8Array.of(1, 2, 3, 4) });
  const parsed = await parsePsd(bytes.buffer);
  assert.equal(parsed.layered, false);
  assert.match(parsed.warnings.join(' '), /máscara global/);
  assert.match(parsed.warnings.join(' '), /recursos de camada/);
});

test('PSD com clipping não suportado usa composto como fallback em vez de perder a aparência', async () => {
  const clipped = makeLayerRecord({ name: 'Clipping', pixels: [[20,20],[30,30],[40,40],[255,255]], clipping: true, flags: 0, blend: 'norm' });
  const bytes = makeLayeredPsd([clipped]);
  const parsed = await parsePsd(bytes.buffer);
  assert.equal(parsed.layered, false);
  assert.match(parsed.warnings.join(' '), /clipping/);
});


test('PSD export keeps raster layers, groups, offsets, opacity and bitmap masks', async () => {
  const makeCanvas = (width, height, values) => {
    const canvas = new FakeCanvas();
    canvas.width = width; canvas.height = height;
    canvas.pixels = new Uint8ClampedArray(values);
    return canvas;
  };
  const bottom = {
    id: 'bottom', type: 'raster', name: 'Base', parentId: 'group', visible: true,
    opacity: 1, blend: 'source-over', x: 0, y: 0,
    canvas: makeCanvas(2, 1, [255, 0, 0, 255, 0, 255, 0, 255]), mask: null
  };
  const top = {
    id: 'top', type: 'raster', name: 'Detalhe 漫画', parentId: 'group', visible: false,
    opacity: 0.5, blend: 'screen', x: 1, y: 0,
    canvas: makeCanvas(1, 1, [0, 0, 255, 255]),
    mask: makeCanvas(1, 1, [128, 128, 128, 255])
  };
  const group = { id: 'group', type: 'group', name: 'Pasta', parentId: null, visible: true, opacity: 0.8, blend: 'source-over', passThrough: true };
  const composite = makeCanvas(2, 1, [255, 0, 0, 255, 0, 0, 255, 128]);
  const doc = { width: 2, height: 1, layers: [bottom, top, group], name: 'roundtrip' };
  const bytes = encodeLayeredPsd(doc, composite);
  const parsed = await parsePsd(bytes.buffer);
  assert.equal(parsed.layered, true);
  assert.equal(parsed.flattened, false);
  assert.deepEqual(parsed.layers.map(layer => layer.name), ['Pasta', 'Base', 'Detalhe 漫画']);
  const importedGroup = parsed.layers.find(layer => layer.type === 'group');
  const importedTop = parsed.layers.find(layer => layer.name === 'Detalhe 漫画');
  assert.equal(importedTop.parentId, importedGroup.id);
  assert.equal(importedTop.visible, false);
  assert.equal(importedTop.opacity, Math.round(0.5 * 255) / 255);
  assert.equal(importedTop.x, 1);
  assert.ok(importedTop.mask);
  assert.deepEqual([...importedTop.mask.getContext('2d').getImageData(0, 0, 1, 1).data], [128, 128, 128, 255]);
});


test('PSD export rasterizes editable text layers into bitmap layers', async () => {
  const base = new FakeCanvas(); base.width = 2; base.height = 1; base.pixels = new Uint8ClampedArray([255,0,0,255,0,0,0,0]);
  const text = { id:'txt', type:'text', name:'Título', text:'MangaCut', x:0, y:0, fontFamily:'Arial', fontSize:12, color:'#112233', visible:true, opacity:1, blend:'source-over', parentId:null };
  const merged = new FakeCanvas(); merged.width=2; merged.height=1; merged.pixels=new Uint8ClampedArray([255,0,0,255,0,0,0,0]);
  const bytes=encodeLayeredPsd({width:2,height:1,layers:[{id:'base',type:'raster',name:'Base',canvas:base,x:0,y:0,visible:true,opacity:1,blend:'source-over',parentId:null},text]},merged);
  assert.equal(bytes.exportStats.textRasterized,1);
  const parsed=await parsePsd(bytes.buffer);
  assert.deepEqual(parsed.layers.map(layer=>layer.name),['Base','Título']);
  assert.ok(parsed.layers.find(layer=>layer.name==='Título'&&layer.type==='raster'));
});

test('PSD export bakes adjustment appearance into a visible merged layer and keeps source layers hidden', async () => {
  const base=new FakeCanvas();base.width=1;base.height=1;base.pixels=new Uint8ClampedArray([30,40,50,255]);
  const merged=new FakeCanvas();merged.width=1;merged.height=1;merged.pixels=new Uint8ClampedArray([220,210,200,255]);
  const bytes=encodeLayeredPsd({width:1,height:1,layers:[{id:'base',type:'raster',name:'Base',canvas:base,x:0,y:0,visible:true,opacity:1,blend:'source-over',parentId:null},{id:'adj',type:'adjustment',name:'Inverter',kind:'invert',visible:true,opacity:1,parentId:null}]},merged);
  assert.equal(bytes.exportStats.adjustmentsBaked,1);
  const parsed=await parsePsd(bytes.buffer);
  assert.equal(parsed.layers[0].name,'Composto visível — ajustes rasterizados');
  assert.equal(parsed.layers[0].visible,true);
  assert.equal(parsed.layers.find(layer=>layer.name==='Base').visible,false);
});

test('PSD em escala de cinza exporta canais Gray+Alpha e preserva camadas', async () => {
  const layerCanvas = new FakeCanvas();
  layerCanvas.width = 1; layerCanvas.height = 1;
  layerCanvas.pixels = new Uint8ClampedArray([255, 0, 0, 128]);
  const composite = new FakeCanvas();
  composite.width = 1; composite.height = 1;
  composite.pixels = new Uint8ClampedArray([255, 0, 0, 128]);
  const doc = {
    width: 1, height: 1, colorMode: 'GRAY',
    layers: [{ id: 'gray-layer', type: 'raster', name: 'Cinza', canvas: layerCanvas, mask: null, x: 0, y: 0, visible: true, opacity: 1, blend: 'source-over' }]
  };
  const bytes = encodeLayeredPsd(doc, composite);
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(header.getUint16(12, false), 2);
  assert.equal(header.getUint16(24, false), 1);
  const parsed = await parsePsd(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.equal(parsed.colorMode, 1);
  assert.equal(parsed.channels, 2);
  assert.equal(parsed.layered, true);
  assert.equal(parsed.layers.length, 1);
  assert.deepEqual([...parsed.rgba], [76, 76, 76, 128]);
});

test('PSB layered export round-trips raster layers, masks, nested groups and Unicode names', async () => {
  const makeCanvas = (values) => { const canvas = new FakeCanvas(); canvas.width = 1; canvas.height = 1; canvas.pixels = new Uint8ClampedArray(values); return canvas; };
  const base = { id: 'base-psb', type: 'raster', name: 'Base PSB', parentId: 'grp-psb', visible: true, opacity: 1, blend: 'source-over', x: 0, y: 0, canvas: makeCanvas([10, 20, 30, 255]), mask: null };
  const detail = { id: 'detail-psb', type: 'raster', name: '線画 漫画', parentId: 'grp-psb', visible: false, opacity: 0.5, blend: 'screen', x: 0, y: 0, canvas: makeCanvas([200, 100, 50, 255]), mask: makeCanvas([128, 128, 128, 255]) };
  const group = { id: 'grp-psb', type: 'group', name: 'Grupo PSB', parentId: null, visible: true, opacity: 1, blend: 'source-over', passThrough: true };
  const composite = makeCanvas([20, 30, 40, 255]);
  const bytes = encodeLayeredPsd({ width: 1, height: 1, colorMode: 'RGB', layers: [base, detail, group] }, composite, { psb: true });
  assert.equal(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(4, false), 2);
  const parsed = await parsePsd(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  assert.equal(parsed.layered, true);
  assert.equal(parsed.version, 2);
  assert.deepEqual(parsed.layers.map(layer => layer.name), ['Grupo PSB', 'Base PSB', '線画 漫画']);
  const importedDetail = parsed.layers.find(layer => layer.name === '線画 漫画');
  assert.equal(importedDetail.visible, false);
  assert.ok(importedDetail.mask);
  assert.equal(importedDetail.parentId, parsed.layers.find(layer => layer.type === 'group').id);
});

test('PSD group masks are detected and safely fall back to the merged composite', async () => {
  const group = makeLayerRecord({ name: 'Grupo com máscara', width: 0, height: 0, sectionType: 1, mask: [128], maskBounds: { x: 0, y: 0, width: 1, height: 1 } });
  const parsed = await parsePsd(makeLayeredPsd([group]).buffer);
  assert.equal(parsed.layered, false);
  assert.match(parsed.warnings.join(' '), /máscara do grupo/i);
});

test('PSD clipping groups are not silently imported as ordinary raster layers', async () => {
  const clipped = makeLayerRecord({ name: 'Clipping avançado', pixels: [[20,20],[30,30],[40,40],[255,255]], clipping: true });
  const parsed = await parsePsd(makeLayeredPsd([clipped]).buffer);
  assert.equal(parsed.layered, false);
  assert.match(parsed.warnings.join(' '), /clipping/i);
});


test('PSD ICC resource is detected and reported without falsely claiming color conversion', async () => {
  const name = Uint8Array.of(0, 0);
  const profile = Uint8Array.of(1, 2, 3, 4);
  const resource = concatBytes(new TextEncoder().encode('8BIM'), be16(0x040F), name, be32(profile.length), profile);
  const parsed = await parsePsd(makeLayeredPsd([], { imageResources: resource }).buffer);
  assert.equal(parsed.colorProfile, 'ICC incorporado (não convertido)');
  assert.match(parsed.warnings.join(' '), /perfil ICC incorporado.*conversão de cores ICC ainda não é aplicada/i);
});

test('PSD image resource parser safely reports malformed ICC resource lengths', async () => {
  const malformed = concatBytes(new TextEncoder().encode('8BIM'), be16(0x040F), Uint8Array.of(0, 0), be32(100));
  const parsed = await parsePsd(makeLayeredPsd([], { imageResources: malformed }).buffer);
  assert.equal(parsed.colorProfile, null);
  assert.match(parsed.warnings.join(' '), /Tamanho de recurso PSD inválido/i);
});

test('PSD mask with reserved flags uses composite fallback and explains the reason', async () => {
  const layer = makeLayerRecord({ name: 'Máscara flags', pixels: [[10,20],[30,40],[50,60],[255,255]], mask: [255,255], maskFlags: 0x80 });
  const parsed = await parsePsd(makeLayeredPsd([layer]).buffer);
  assert.equal(parsed.layered, false);
  assert.match(parsed.warnings.join(' '), /flags reservadas\/desconhecidas/i);
});

test('V1 real PSD fixture imports as a layered document in V2 parser', async () => {
  const { readFile } = await import('node:fs/promises');
  const fixture = await readFile(new URL('./fixtures/PSD_V10_roundtrip.psd', import.meta.url));
  const buffer = fixture.buffer.slice(fixture.byteOffset, fixture.byteOffset + fixture.byteLength);
  const parsed = await parsePsd(buffer);
  assert.equal(parsed.width, 735);
  assert.equal(parsed.height, 630);
  assert.equal(parsed.layered, true);
  assert.equal(parsed.layers.length, 5);
  assert.deepEqual(parsed.warnings, []);
});

test('V12.4 historical PSD fixture remains readable by the V2 parser', async () => {
  const { readFile } = await import('node:fs/promises');
  const fixture = await readFile(new URL('./fixtures/PSD_V12_4_roundtrip.psd', import.meta.url));
  const buffer = fixture.buffer.slice(fixture.byteOffset, fixture.byteOffset + fixture.byteLength);
  const parsed = await parsePsd(buffer);
  assert.equal(parsed.width, 735);
  assert.equal(parsed.height, 630);
  assert.equal(parsed.layered, true);
  assert.equal(parsed.layers.length, 5);
});
