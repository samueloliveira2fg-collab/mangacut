import { makeCanvas } from '../core/state.js';
import { createDocument, createLayer } from '../core/document.js';
import { downloadBlob } from './project.js';

const MAX_CHANNEL_PIXELS = 100_000_000;
const MAX_PSD_EXPORT_MEMORY_BYTES = 512_000_000;
const MAX_PSD_DECODE_BYTES = 512_000_000;
const MAX_LAYER_IMPORT_BYTES = 256_000_000;
const MAX_LAYER_RECORDS = 4_000;
const SIGNATURE = '8BPS';

// Baseline peak estimate for the composite decode: planar channel bytes + RGBA output.
// Layer decoding is charged against the same budget separately before allocation.
export function estimatePsdDecodeMemory(width, height, channels) {
  if (![width, height, channels].every(Number.isSafeInteger) || width < 1 || height < 1 || channels < 1) return Infinity;
  const pixels = width * height;
  const bytes = pixels * (channels + 4);
  return Number.isSafeInteger(bytes) ? bytes : Infinity;
}

// Conservative peak estimate for export: source readbacks, channel planes,
// temporary joined buffers and final output. It is a memory guard, not a pixel cap.
export function estimatePsdExportMemory(doc, { psb = false } = {}) {
  if (!doc || !Number.isSafeInteger(doc.width) || !Number.isSafeInteger(doc.height) || doc.width < 1 || doc.height < 1) return Infinity;
  const pixels = doc.width * doc.height;
  if (!Number.isSafeInteger(pixels)) return Infinity;
  const gray = doc.colorMode === 'GRAY';
  let bytes = pixels * (psb ? 8 : (gray ? 10 : 16));
  const nodes = doc.layers || [];
  const byId = new Map();
  for (const node of nodes) {
    if (!node || typeof node.id !== 'string' || byId.has(node.id)) return Infinity;
    byId.set(node.id, node);
  }
  const visited = new Set();
  const seen = new Set();
  const stack = [{ id: null, exit: false }];
  while (stack.length) {
    const item = stack.pop();
    if (item.exit) { visited.delete(item.id); continue; }
    const node = item.id === null ? null : byId.get(item.id);
    if (item.id !== null) {
      if (!node || visited.has(item.id)) return Infinity;
      visited.add(item.id);
      if (seen.has(item.id)) return Infinity;
      seen.add(item.id);
      stack.push({ id: item.id, exit: true });
      if (node.type !== 'group' && node.type !== 'adjustment') {
        if (node.type === 'raster' && node.canvas) {
          const area = node.canvas.width * node.canvas.height;
          if (!Number.isSafeInteger(area) || area < 0) return Infinity;
          bytes += area * (gray ? 8 : 16);
          if (node.mask) {
            const maskArea = node.mask.width * node.mask.height;
            if (!Number.isSafeInteger(maskArea) || maskArea < 0) return Infinity;
            bytes += maskArea * 8;
          }
        } else if (node.type === 'text') bytes += pixels * (gray ? 8 : 16);
        if (!Number.isSafeInteger(bytes)) return Infinity;
      }
    }
    const parentId = item.id;
    for (let i = nodes.length - 1; i >= 0; i--) {
      if ((nodes[i].parentId ?? null) === parentId) stack.push({ id: nodes[i].id, exit: false });
    }
  }
  return visited.size === 0 && seen.size === nodes.length ? bytes : Infinity;
}

function assertExportMemoryBudget(doc, options = {}) {
  const estimate = estimatePsdExportMemory(doc, options);
  if (!Number.isFinite(estimate) || estimate > MAX_PSD_EXPORT_MEMORY_BYTES) {
    const mib = Number.isFinite(estimate) ? (estimate / 1048576).toFixed(0) : 'indeterminada';
    throw new Error(`Exportação cancelada por segurança: pico estimado de ${mib} MiB; orçamento desta versão: ${(MAX_PSD_EXPORT_MEMORY_BYTES / 1048576).toFixed(0)} MiB. Reduza camadas/tamanho ou exporte em partes.`);
  }
  return estimate;
}

class Reader {
  constructor(buffer) { this.bytes = new Uint8Array(buffer); this.view = new DataView(buffer); this.offset = 0; }
  ensure(size) { if (!Number.isSafeInteger(size) || size < 0 || this.offset + size > this.bytes.length) throw new Error('Arquivo PSD/PSB truncado ou inválido.'); }
  u8() { this.ensure(1); return this.view.getUint8(this.offset++); }
  i16() { this.ensure(2); const v = this.view.getInt16(this.offset, false); this.offset += 2; return v; }
  u16() { this.ensure(2); const v = this.view.getUint16(this.offset, false); this.offset += 2; return v; }
  i32() { this.ensure(4); const v = this.view.getInt32(this.offset, false); this.offset += 4; return v; }
  u32() { this.ensure(4); const v = this.view.getUint32(this.offset, false); this.offset += 4; return v; }
  u64() {
    this.ensure(8); const value = this.view.getBigUint64(this.offset, false); this.offset += 8;
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Seção PSD/PSB excede o limite seguro de leitura.');
    return Number(value);
  }
  skip(n) { this.ensure(n); this.offset += n; }
  take(n) { this.ensure(n); const result = this.bytes.subarray(this.offset, this.offset + n); this.offset += n; return result; }
  str(n) { return new TextDecoder('latin1').decode(this.take(n)); }
}

function decodePackBits(bytes, expected) {
  const out = new Uint8Array(expected);
  let src = 0, dst = 0;
  while (src < bytes.length && dst < expected) {
    const n = (bytes[src++] << 24) >> 24;
    if (n >= 0) {
      const count = n + 1;
      if (src + count > bytes.length || dst + count > expected) throw new Error('Linha RLE PSD inválida.');
      out.set(bytes.subarray(src, src + count), dst); src += count; dst += count;
    } else if (n >= -127) {
      if (src >= bytes.length) throw new Error('Linha RLE PSD truncada.');
      const count = 1 - n;
      if (dst + count > expected) throw new Error('Linha RLE PSD excede o tamanho esperado.');
      out.fill(bytes[src++], dst, dst + count); dst += count;
    }
  }
  if (dst !== expected) throw new Error('A linha RLE PSD não contém os pixels esperados.');
  return out;
}

async function inflateZlib(bytes, expectedLength) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não oferece descompressão ZIP para PSD. Use Chrome ou Edge atualizado.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  const result = new Uint8Array(await new Response(stream).arrayBuffer());
  if (expectedLength != null && result.length !== expectedLength) throw new Error(`Tamanho ZIP PSD inesperado (${result.length}; esperado ${expectedLength}).`);
  return result;
}

function undoPrediction(data, width, height) {
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 1; x < width; x++) data[row + x] = (data[row + x] + data[row + x - 1]) & 255;
  }
}

async function decodeChannel(payload, width, height, psb) {
  if (width < 1 || height < 1 || width * height > MAX_CHANNEL_PIXELS) throw new Error('Dimensões inválidas em canal de camada PSD.');
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  if (payload.length < 2) throw new Error('Canal de camada PSD sem cabeçalho de compressão.');
  const compression = view.getUint16(0, false);
  const body = payload.subarray(2);
  const expected = width * height;
  if (compression === 0) {
    if (body.length < expected) throw new Error('Canal RAW de camada PSD truncado.');
    return body.slice(0, expected);
  }
  if (compression === 1) {
    const lengthSize = psb ? 4 : 2;
    const tableBytes = height * lengthSize;
    if (body.length < tableBytes) throw new Error('Tabela RLE de camada PSD truncada.');
    const lengths = new Uint32Array(height);
    let tableOffset = 0;
    for (let y = 0; y < height; y++) {
      lengths[y] = lengthSize === 4
        ? new DataView(body.buffer, body.byteOffset + tableOffset, 4).getUint32(0, false)
        : new DataView(body.buffer, body.byteOffset + tableOffset, 2).getUint16(0, false);
      tableOffset += lengthSize;
    }
    const out = new Uint8Array(expected);
    let dataOffset = tableBytes;
    for (let y = 0; y < height; y++) {
      const count = lengths[y];
      if (dataOffset + count > body.length) throw new Error('Dados RLE de camada PSD truncados.');
      out.set(decodePackBits(body.subarray(dataOffset, dataOffset + count), width), y * width);
      dataOffset += count;
    }
    return out;
  }
  if (compression === 2 || compression === 3) {
    const out = await inflateZlib(body, expected);
    if (compression === 3) undoPrediction(out, width, height);
    return out;
  }
  throw new Error(`Compressão de camada PSD desconhecida: ${compression}.`);
}

function blendToCanvas(key) {
  const modes = {
    norm: 'source-over', pass: 'source-over', 'mul ': 'multiply', scrn: 'screen', over: 'overlay',
    dark: 'darken', lite: 'lighten', diff: 'difference', 'div ': 'color-dodge', idiv: 'color-burn',
    hLit: 'hard-light', sLit: 'soft-light', plus: 'lighter', 'xor ': 'xor',
    'hue ': 'hue', 'sat ': 'saturation', colr: 'color', 'lum ': 'luminosity'
  };
  return modes[key] || null;
}

function readPascalName(reader, extraEnd) {
  if (reader.offset >= extraEnd) return '';
  const length = reader.u8();
  const bytes = reader.take(Math.min(length, extraEnd - reader.offset));
  // PSD legacy Pascal names are commonly MacRoman/ASCII; Unicode name is read from `luni` when present.
  let name = '';
  for (const byte of bytes) name += String.fromCharCode(byte);
  const consumed = 1 + bytes.length;
  const padding = (4 - (consumed % 4)) % 4;
  if (reader.offset + padding <= extraEnd) reader.skip(padding);
  return name;
}

function readUnicodeLayerName(bytes) {
  if (bytes.length < 4) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const charCount = view.getUint32(0, false);
  if (charCount > 32768 || 4 + charCount * 2 > bytes.length) return null;
  let name = '';
  for (let i = 0; i < charCount; i++) name += String.fromCharCode(view.getUint16(4 + i * 2, false));
  return name;
}

function parseLayerExtra(reader, length, psb) {
  const end = reader.offset + length;
  if (end > reader.bytes.length) throw new Error('Bloco extra de camada PSD inválido.');
  const result = { name: '', sectionDividerType: 0, maskInfo: null, unknownBlocks: [] };
  if (reader.offset + 4 > end) { reader.offset = end; return result; }

  const maskLength = reader.u32();
  if (maskLength > 0) {
    const maskBytes = reader.take(maskLength);
    if (maskBytes.length >= 18) {
      const mv = new DataView(maskBytes.buffer, maskBytes.byteOffset, maskBytes.byteLength);
      result.maskInfo = {
        top: mv.getInt32(0, false), left: mv.getInt32(4, false),
        bottom: mv.getInt32(8, false), right: mv.getInt32(12, false),
        defaultColor: mv.getUint8(16), flags: mv.getUint8(17),
        disabled: (mv.getUint8(17) & 0x02) !== 0, relativeToLayer: (mv.getUint8(17) & 0x01) !== 0, invert: (mv.getUint8(17) & 0x04) !== 0
      };
    }
  }
  if (reader.offset + 4 > end) { reader.offset = end; return result; }
  const blendingLength = reader.u32();
  if (blendingLength) {
    const blendBytes = reader.take(blendingLength);
    const defaultRange = [0, 0, 255, 255, 0, 0, 255, 255];
    result.hasCustomBlendRanges = blendBytes.length >= 8 && defaultRange.some((value, i) => blendBytes[i] !== value);
  }
  result.name = readPascalName(reader, end);

  // Recover minor legacy name-padding inconsistencies by looking for the next valid additional-info signature.
  while (reader.offset + 12 <= end) {
    const sig = reader.str(4);
    if (sig !== '8BIM' && sig !== '8B64') { reader.offset -= 3; continue; }
    const key = reader.str(4);
    const blockLength = sig === '8B64' ? reader.u64() : reader.u32();
    if (blockLength > end - reader.offset) throw new Error(`Bloco ${key} excede a seção extra da camada.`);
    const block = reader.take(blockLength);
    if (key === 'luni') result.unicodeName = readUnicodeLayerName(block);
    else if (key === 'lsct' || key === 'lsdk') {
      if (block.length >= 4) result.sectionDividerType = new DataView(block.buffer, block.byteOffset, block.byteLength).getUint32(0, false);
    } else if (!['lyid', 'lspf', 'lclr'].includes(key)) {
      result.unknownBlocks.push(key);
    }
    if (reader.offset % 2) reader.skip(1);
  }
  reader.offset = end;
  if (result.unicodeName) result.name = result.unicodeName;
  return result;
}

function parseLayerRecord(reader, psb) {
  const top = reader.i32(), left = reader.i32(), bottom = reader.i32(), right = reader.i32();
  const width = right - left, height = bottom - top;
  if (width < 0 || height < 0 || width > 300000 || height > 300000 || width * height > MAX_CHANNEL_PIXELS) throw new Error('Dimensões de camada PSD inválidas ou grandes demais.');
  const channelCount = reader.u16();
  if (channelCount > 64) throw new Error('Quantidade de canais da camada PSD inválida.');
  const channels = [];
  for (let i = 0; i < channelCount; i++) {
    const id = reader.i16();
    const length = psb ? reader.u64() : reader.u32();
    if (!Number.isSafeInteger(length) || length < 0) throw new Error('Comprimento de canal PSD/PSB excede a faixa segura suportada.');
    if (length > reader.bytes.length - reader.offset) throw new Error('Comprimento do canal PSD excede o arquivo.');
    channels.push({ id, length });
  }
  if (reader.str(4) !== '8BIM') throw new Error('Assinatura de modo de mesclagem de camada PSD inválida.');
  const blendKey = reader.str(4);
  const opacity = reader.u8() / 255;
  const clipping = reader.u8() === 1;
  const flags = reader.u8();
  reader.skip(1);
  const extraLength = reader.u32();
  const extra = parseLayerExtra(reader, extraLength, psb);
  return {
    top, left, bottom, right, width, height, channels,
    blendKey, blend: blendToCanvas(blendKey) || 'source-over', unsupportedBlend: !blendToCanvas(blendKey), opacity,
    visible: (flags & 0x02) === 0, locked: false, protectAlpha: (flags & 0x01) !== 0,
    clipping, sectionDividerType: extra.sectionDividerType, customBlendRanges: !!extra.hasCustomBlendRanges,
    name: extra.name || (extra.sectionDividerType ? 'Grupo importado' : 'Camada importada'),
    maskInfo: extra.maskInfo, rawChannelData: [], rawIndex: -1, parentRawIndex: null,
    isGroup: extra.sectionDividerType === 1 || extra.sectionDividerType === 2,
    isDivider: extra.sectionDividerType === 3, unsupportedBlocks: extra.unknownBlocks
  };
}

async function parseLayerAndMask(reader, sectionLength, psb, colorMode, width, height, warnings, baseDecodeBytes) {
  if (!sectionLength) return { layers: [], layered: false };
  const sectionEnd = reader.offset + sectionLength;
  if (sectionEnd > reader.bytes.length) throw new Error('Seção Layer and Mask do PSD excede o arquivo.');
  if (reader.offset + (psb ? 8 : 4) > sectionEnd) return { layers: [], layered: false };
  const layerInfoLength = psb ? reader.u64() : reader.u32();
  const layerInfoEnd = reader.offset + layerInfoLength;
  if (layerInfoEnd > sectionEnd || layerInfoEnd > reader.bytes.length) throw new Error('Seção de informações das camadas PSD inválida.');
  if (!layerInfoLength) { reader.offset = sectionEnd; return { layers: [], layered: false }; }

  const signedCount = reader.i16();
  const count = Math.abs(signedCount);
  if (count > MAX_LAYER_RECORDS) throw new Error(`PSD contém mais de ${MAX_LAYER_RECORDS} registros de camada; importação interrompida por segurança.`);
  const records = [];
  for (let i = 0; i < count; i++) {
    const rec = parseLayerRecord(reader, psb);
    rec.rawIndex = i;
    records.push(rec);
  }

  // Channel pixel data follows all layer records, in the same record/channel order.
  for (const rec of records) {
    for (const ch of rec.channels) {
      ch.payload = reader.take(ch.length);
    }
  }
  reader.offset = layerInfoEnd;
  let unsupported = false;
  // A global layer mask or document-level extension can change the final appearance.
  // Do not claim a faithful layer import when one is present but not interpreted.
  const trailingBytes = sectionEnd - layerInfoEnd;
  if (trailingBytes > 0) {
    if (trailingBytes < 4) {
      unsupported = true;
      warnings.push('Há dados globais incompletos na seção de camadas do PSD; será usada a imagem composta.');
    } else {
      const globalMaskLength = reader.u32();
      if (globalMaskLength > sectionEnd - reader.offset) throw new Error('Máscara global PSD excede a seção.');
      if (globalMaskLength > 0) {
        unsupported = true;
        warnings.push('A máscara global do documento não é reproduzida nesta versão.');
      }
      reader.skip(globalMaskLength);
      if (reader.offset < sectionEnd) {
        unsupported = true;
        warnings.push('O PSD contém blocos globais adicionais ainda não interpretados; a imagem composta será usada.');
      }
    }
  }

  const stack = [];
  let malformedGroups = false;
  for (let i = records.length - 1; i >= 0; i--) {
    const rec = records[i];
    if (rec.isDivider) {
      if (stack.length) stack.pop();
      else malformedGroups = true;
    } else {
      rec.parentRawIndex = stack.length ? stack[stack.length - 1] : null;
      if (rec.isGroup) stack.push(i);
    }
  }
  if (stack.length || malformedGroups) {
    unsupported = true;
    warnings.push('Os marcadores de grupo do PSD estão incompletos ou inconsistentes; a imagem composta será usada para preservar a aparência.');
  }

  let estimatedLayerBytes = 0;
  const layerPixels = new Map();
  for (const rec of records) {
    if (rec.isDivider) continue;
    if (rec.unsupportedBlocks.length || rec.unsupportedBlend || rec.customBlendRanges) unsupported = true;
    if (rec.isGroup) {
      if (rec.maskInfo) { unsupported = true; warnings.push(`A máscara do grupo "${rec.name}" não é aplicada nesta versão.`); }
      continue;
    }
    if (!rec.width || !rec.height) { unsupported = true; continue; }
    const colorIds = colorMode === 3 ? [0, 1, 2] : [0];
    const channelsById = new Map(rec.channels.map(ch => [ch.id, ch]));
    if (!colorIds.every(id => channelsById.has(id))) { unsupported = true; continue; }
    if (rec.clipping) { unsupported = true; warnings.push(`A camada \"${rec.name}\" participa de um grupo de clipping ainda não reproduzido; será usada a imagem composta.`); continue; }
    if (rec.channels.some(ch => ch.id < -2 || ch.id > 2)) { unsupported = true; warnings.push(`A camada \"${rec.name}\" contém canais especiais ainda não suportados.`); continue; }
    if (rec.maskInfo && (rec.maskInfo.flags & 0xF0)) { unsupported = true; warnings.push(`A máscara da camada \"${rec.name}\" contém flags reservadas/desconhecidas; será usada a imagem composta.`); }
    if (rec.channels.some(ch => ch.id < -2)) { unsupported = true; warnings.push(`A camada "${rec.name}" contém canais especiais não suportados.`); }
    const maskWidth = rec.maskInfo ? rec.maskInfo.right - rec.maskInfo.left : rec.width;
    const maskHeight = rec.maskInfo ? rec.maskInfo.bottom - rec.maskInfo.top : rec.height;
    const maskArea = maskWidth * maskHeight;
    if (!Number.isSafeInteger(maskWidth) || !Number.isSafeInteger(maskHeight) || maskWidth < 0 || maskHeight < 0 ||
        (rec.maskInfo && !rec.maskInfo.disabled && (!maskWidth || !maskHeight)) ||
        !Number.isSafeInteger(maskArea) || maskArea > MAX_CHANNEL_PIXELS) {
      unsupported = true; warnings.push(`A geometria da máscara da camada "${rec.name}" é inválida.`); continue;
    }
    estimatedLayerBytes += rec.width * rec.height * (colorMode === 3 ? 12 : 8) + (rec.maskInfo ? maskWidth * maskHeight * 5 : 0);
    if (estimatedLayerBytes > MAX_LAYER_IMPORT_BYTES || baseDecodeBytes + estimatedLayerBytes > MAX_PSD_DECODE_BYTES) {
      unsupported = true;
      warnings.push('A estimativa conjunta de memória do composto e das camadas excedeu o orçamento de 512 MB. A imagem composta será usada para evitar consumo excessivo de RAM.');
      return { layers: [], layered: false };
    }
    const decoded = new Map();
    for (const id of [...colorIds, -1, ...(rec.maskInfo?.disabled ? [] : [-2])]) {
      const ch = channelsById.get(id);
      if (!ch) continue;
      decoded.set(id, await decodeChannel(ch.payload, id === -2 && rec.maskInfo ? maskWidth : rec.width,
        id === -2 && rec.maskInfo ? maskHeight : rec.height, psb));
    }
    const rgba = new Uint8ClampedArray(rec.width * rec.height * 4);
    const alpha = decoded.get(-1);
    const first = decoded.get(colorIds[0]), second = decoded.get(colorIds[1]), third = decoded.get(colorIds[2]);
    for (let p = 0; p < rec.width * rec.height; p++) {
      const out = p * 4;
      if (colorMode === 3) { rgba[out] = first[p]; rgba[out + 1] = second[p]; rgba[out + 2] = third[p]; }
      else rgba[out] = rgba[out + 1] = rgba[out + 2] = first[p];
      rgba[out + 3] = alpha ? alpha[p] : 255;
    }
    let mask = null;
    const maskData = decoded.get(-2);
    if (maskData && rec.maskInfo?.disabled) {
      mask = null;
    } else if (maskData && rec.maskInfo) {
      // Convert PSD's independently positioned mask rectangle into the editor's
      // layer-local mask surface. Pixels outside the PSD mask rectangle use its
      // declared default color, rather than discarding the entire layer tree.
      const maskInfo = rec.maskInfo;
      const localLeft = maskInfo.left + (maskInfo.relativeToLayer ? rec.left : 0) - rec.left;
      const localTop = maskInfo.top + (maskInfo.relativeToLayer ? rec.top : 0) - rec.top;
      const expanded = new Uint8Array(rec.width * rec.height);
      expanded.fill(maskInfo.defaultColor);
      const x0 = Math.max(0, localLeft), y0 = Math.max(0, localTop);
      const x1 = Math.min(rec.width, localLeft + maskWidth), y1 = Math.min(rec.height, localTop + maskHeight);
      for (let y = y0; y < y1; y++) {
        const sourceY = y - localTop;
        for (let x = x0; x < x1; x++) {
          const sourceX = x - localLeft;
          const value = maskData[sourceY * maskWidth + sourceX];
          expanded[y * rec.width + x] = maskInfo.invert ? 255 - value : value;
        }
      }
      mask = expanded;
    } else if (maskData || (rec.maskInfo && !rec.maskInfo.disabled)) {
      unsupported = true;
      warnings.push(`A máscara da camada "${rec.name}" não possui geometria válida; será usada a imagem composta.`);
    }
    layerPixels.set(rec.rawIndex, { rgba, mask });
  }

  if (unsupported) {
    warnings.push('O PSD contém recursos de camada que ainda não podem ser reproduzidos fielmente (por exemplo, clipping, certos tipos especiais ou máscaras com geometria diferente). A imagem composta será usada para preservar a aparência.');
    return { layers: [], layered: false };
  }

  const ids = new Map();
  for (const rec of records) if (!rec.isDivider) ids.set(rec.rawIndex, crypto.randomUUID());
  const result = [];
  for (const rec of [...records].reverse()) {
    if (rec.isDivider) continue;
    const parentId = rec.parentRawIndex == null ? null : ids.get(rec.parentRawIndex) || null;
    if (rec.isGroup) {
      result.push({
        id: ids.get(rec.rawIndex), type: 'group', name: rec.name,
        visible: rec.visible, opacity: rec.opacity, blend: rec.blend,
        parentId, locked: false, expanded: rec.sectionDividerType === 1,
        passThrough: rec.blendKey === 'pass', x: rec.left, y: rec.top
      });
      continue;
    }
    const pixels = layerPixels.get(rec.rawIndex);
    if (!pixels) continue;
    const canvas = makeCanvas(rec.width, rec.height);
    canvas.getContext('2d').putImageData(new ImageData(pixels.rgba, rec.width, rec.height), 0, 0);
    let mask = null;
    if (pixels.mask) {
      mask = makeCanvas(rec.width, rec.height);
      const mrgba = new Uint8ClampedArray(rec.width * rec.height * 4);
      for (let p = 0; p < pixels.mask.length; p++) {
        const value = pixels.mask[p], o = p * 4;
        mrgba[o] = mrgba[o + 1] = mrgba[o + 2] = value; mrgba[o + 3] = 255;
      }
      mask.getContext('2d').putImageData(new ImageData(mrgba, rec.width, rec.height), 0, 0);
    }
    result.push({
      id: ids.get(rec.rawIndex), type: 'raster', name: rec.name,
      canvas, mask, visible: rec.visible, opacity: rec.opacity,
      blend: rec.blend, x: rec.left, y: rec.top, parentId,
      locked: false, protectAlpha: rec.protectAlpha, clipping: false, expanded: true
    });
  }
  if (result.length) return { layers: result, layered: true };
  return { layers: [], layered: false };
}

function inspectImageResources(bytes) {
  const resourceBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const reader = new Reader(resourceBuffer);
  let hasIccProfile = false;
  const warnings = [];
  while (reader.offset < reader.bytes.length) {
    if (reader.bytes.length - reader.offset < 12) { warnings.push('Bloco de recursos PSD incompleto; metadados restantes foram ignorados.'); break; }
    const signature = reader.str(4);
    if (signature !== '8BIM' && signature !== 'MeSa') { warnings.push('Assinatura de recurso PSD desconhecida; metadados restantes foram ignorados.'); break; }
    const id = reader.u16();
    const nameLength = reader.u8();
    reader.skip(nameLength + ((nameLength + 1) % 2));
    const size = reader.u32();
    if (size > reader.bytes.length - reader.offset) { warnings.push('Tamanho de recurso PSD inválido; metadados restantes foram ignorados.'); break; }
    if (id === 0x040F && size > 0) hasIccProfile = true;
    reader.skip(size + (size % 2));
  }
  return { hasIccProfile, warnings };
}

export async function parsePsd(buffer) {
  const r = new Reader(buffer);
  if (r.str(4) !== SIGNATURE) throw new Error('O arquivo não possui assinatura PSD/PSB válida.');
  const version = r.u16();
  if (version !== 1 && version !== 2) throw new Error('Versão PSD/PSB não suportada.');
  const psb = version === 2;
  r.skip(6);
  const channels = r.u16(), height = r.u32(), width = r.u32(), depth = r.u16(), colorMode = r.u16();
  if (width < 1 || height < 1 || width > 300000 || height > 300000 || width * height > MAX_CHANNEL_PIXELS) throw new Error('Dimensões PSD/PSB inválidas ou grandes demais para um canal.');
  if (channels < 1 || channels > 56) throw new Error('Quantidade de canais PSD inválida.');
  const estimatedDecodeBytes = estimatePsdDecodeMemory(width, height, channels);
  if (estimatedDecodeBytes > MAX_PSD_DECODE_BYTES) throw new Error(`Importação PSD/PSB cancelada: a estimativa mínima de decodificação é ${(estimatedDecodeBytes / 1048576).toFixed(0)} MiB, acima do orçamento de 512 MiB desta versão.`);
  if (depth !== 8) throw new Error('Esta etapa importa PSD/PSB RGB de 8 bits por canal. Arquivos de 16/32 bits ainda não são suportados.');
  if (colorMode !== 3 && colorMode !== 1) throw new Error('Nesta etapa, PSD/PSB precisa estar em RGB ou escala de cinza. CMYK, Lab e Indexed ficam para uma etapa posterior.');
  r.skip(r.u32()); // color mode data
  const resourceLength = r.u32();
  const resourceBytes = r.take(resourceLength);
  const resourceInfo = inspectImageResources(resourceBytes);
  const layerSectionStart = r.offset;
  const layerMaskLength = psb ? r.u64() : r.u32();
  const warnings = [...resourceInfo.warnings];
  if (resourceInfo.hasIccProfile) warnings.push('O arquivo contém um perfil ICC incorporado. O perfil foi identificado, mas a conversão de cores ICC ainda não é aplicada.');
  let layerImport = { layers: [], layered: false };
  try {
    layerImport = await parseLayerAndMask(r, layerMaskLength, psb, colorMode, width, height, warnings, estimatedDecodeBytes);
  } catch (error) {
    warnings.push(`As camadas não puderam ser interpretadas com segurança: ${error.message}`);
  }
  // Always continue at the start of merged composite data. This allows a safe flattened fallback.
  // Continue at the composite section even if the optional layer parser rejected a block.
  const dataOffset = layerSectionStart + (psb ? 8 : 4) + layerMaskLength;
  if (!Number.isSafeInteger(dataOffset) || dataOffset < 0 || dataOffset + 2 > r.bytes.length) throw new Error('Seção Layer and Mask inválida: não foi possível localizar a imagem composta.');
  r.offset = dataOffset;

  const compression = r.u16();
  const planeSize = width * height;
  const total = planeSize * channels;
  if (!Number.isSafeInteger(total) || total > MAX_PSD_DECODE_BYTES) throw new Error('Dados de imagem PSD excedem o orçamento de memória desta versão.');
  const planar = new Uint8Array(total);
  if (compression === 0) {
    planar.set(r.take(total));
  } else if (compression === 1) {
    const rowCount = channels * height;
    const rowLengths = new Uint32Array(rowCount);
    for (let i = 0; i < rowCount; i++) rowLengths[i] = psb ? r.u32() : r.u16();
    for (let c = 0; c < channels; c++) {
      for (let y = 0; y < height; y++) {
        const rowIndex = c * height + y;
        const decoded = decodePackBits(r.take(rowLengths[rowIndex]), width);
        planar.set(decoded, c * planeSize + y * width);
      }
    }
  } else if (compression === 2 || compression === 3) {
    const inflated = await inflateZlib(r.take(r.bytes.length - r.offset), total);
    planar.set(inflated);
    if (compression === 3) {
      for (let c = 0; c < channels; c++) undoPrediction(planar.subarray(c * planeSize, (c + 1) * planeSize), width, height);
    }
  } else {
    throw new Error(`Compressão PSD desconhecida: ${compression}.`);
  }

  const rgba = new Uint8ClampedArray(planeSize * 4);
  if (colorMode === 3) {
    for (let i = 0; i < planeSize; i++) {
      rgba[i * 4] = planar[i]; rgba[i * 4 + 1] = planar[planeSize + i]; rgba[i * 4 + 2] = planar[planeSize * 2 + i];
      rgba[i * 4 + 3] = channels > 3 ? planar[planeSize * 3 + i] : 255;
    }
  } else {
    for (let i = 0; i < planeSize; i++) {
      const gray = planar[i]; rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = gray;
      rgba[i * 4 + 3] = channels > 1 ? planar[planeSize + i] : 255;
    }
  }
  if (!layerImport.layered) warnings.push('O PSD/PSB foi aberto como imagem composta achatada. A estrutura original de camadas não foi preservada.');
  return { width, height, rgba, version, channels, colorMode, depth, colorProfile: resourceInfo.hasIccProfile ? 'ICC incorporado (não convertido)' : null, flattened: !layerImport.layered, layers: layerImport.layers, layered: layerImport.layered, warnings };
}

export async function importPsdFile(file) {
  const parsed = await parsePsd(await file.arrayBuffer());
  const doc = createDocument(parsed.width, parsed.height, file.name, 'transparent');
  doc.layers = [];
  doc.colorMode = parsed.colorMode === 1 ? 'GRAY' : 'RGB';
  doc.colorProfile = parsed.colorProfile;
  if (parsed.layered) {
    for (const node of parsed.layers) doc.layers.push(node);
    const raster = doc.layers.filter(node => node.type === 'raster').at(-1);
    doc.activeId = raster?.id || doc.layers[0]?.id || null;
    doc.importInfo = { source: file.name, flattened: false, warnings: parsed.warnings };
  } else {
    const canvas = makeCanvas(parsed.width, parsed.height);
    canvas.getContext('2d').putImageData(new ImageData(parsed.rgba, parsed.width, parsed.height), 0, 0);
    const layer = createLayer(doc, `Composto importado — ${file.name}`, canvas);
    doc.layers.push(layer); doc.activeId = layer.id;
    doc.importInfo = { source: file.name, flattened: true, warnings: parsed.warnings };
  }
  return doc;
}


function be16(value) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, value & 0xffff, false); return b; }
function bei16(value) { const b = new Uint8Array(2); new DataView(b.buffer).setInt16(0, value, false); return b; }
function be32(value) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, value >>> 0, false); return b; }
function be64(value) { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(value), false); return b; }
function bei32(value) { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, value, false); return b; }
function joinBytes(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total); let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}
function psdBlock(key, payload) {
  return joinBytes(new TextEncoder().encode('8BIM'), new TextEncoder().encode(key), be32(payload.length), payload, payload.length % 2 ? Uint8Array.of(0) : new Uint8Array(0));
}
function psdPascalName(name) {
  const encoded = new TextEncoder().encode(String(name || 'Camada').slice(0, 255));
  const raw = joinBytes(Uint8Array.of(encoded.length), encoded);
  return joinBytes(raw, new Uint8Array((4 - raw.length % 4) % 4));
}
function psdUnicodeName(name) {
  const chars = Array.from(String(name || 'Camada'));
  return joinBytes(be32(chars.length), ...chars.map(char => be16(char.charCodeAt(0))));
}
function canvasPlanes(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const planes = [new Uint8Array(canvas.width * canvas.height), new Uint8Array(canvas.width * canvas.height), new Uint8Array(canvas.width * canvas.height), new Uint8Array(canvas.width * canvas.height)];
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    planes[0][p] = pixels[i]; planes[1][p] = pixels[i + 1]; planes[2][p] = pixels[i + 2]; planes[3][p] = pixels[i + 3];
  }
  return planes;
}
function grayscalePlane(canvas) {
  const data = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;
  const plane = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) plane[p] = Math.round((data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000);
  return plane;
}
const PSD_BLEND_KEYS = {
  'source-over': 'norm', multiply: 'mul ', screen: 'scrn', overlay: 'over', darken: 'dark', lighten: 'lite',
  difference: 'diff', 'color-dodge': 'div ', 'color-burn': 'idiv', 'hard-light': 'hLit', 'soft-light': 'sLit',
  lighter: 'plus', xor: 'xor', hue: 'hue ', saturation: 'sat ', color: 'colr', luminosity: 'lum '
};
function makeLayerExtra(name, { groupType = 0, mask = null, left = 0, top = 0 } = {}) {
  let maskInfo = new Uint8Array(0);
  if (mask) maskInfo = joinBytes(bei32(top), bei32(left), bei32(top + mask.height), bei32(left + mask.width), Uint8Array.of(255, 0));
  const blocks = [psdBlock('luni', psdUnicodeName(name))];
  if (groupType) blocks.push(psdBlock('lsct', joinBytes(be32(groupType), new TextEncoder().encode('8BIM'), new TextEncoder().encode(groupType === 1 ? 'pass' : 'norm'))));
  return joinBytes(be32(maskInfo.length), maskInfo, be32(0), psdPascalName(name), ...blocks);
}
function makePsdLayerRecord(node, { groupType = 0, forceHidden = false, colorMode = 'RGB', psb = false } = {}) {
  const isGroup = !!groupType;
  const canvas = !isGroup ? node.canvas : null;
  const left = isGroup ? 0 : Math.round(node.x || 0), top = isGroup ? 0 : Math.round(node.y || 0);
  const width = canvas?.width || 0, height = canvas?.height || 0;
  if (!isGroup && (!width || !height || width * height > MAX_CHANNEL_PIXELS)) throw new Error(`A camada "${node.name}" possui dimensões inválidas para exportação PSD.`);
  const channels = [];
  if (!isGroup) {
    if (colorMode === 'GRAY') {
      channels.push({ id: -1, bytes: joinBytes(be16(0), canvasPlanes(canvas)[3]) });
      channels.push({ id: 0, bytes: joinBytes(be16(0), grayscalePlane(canvas)) });
    } else {
      const planes = canvasPlanes(canvas);
      for (let id = 0; id < 4; id++) channels.push({ id: id === 3 ? -1 : id, bytes: joinBytes(be16(0), planes[id]) });
    }
    if (node.mask) channels.push({ id: -2, bytes: joinBytes(be16(0), grayscalePlane(node.mask)) });
  }
  const extra = makeLayerExtra(node.name, { groupType, mask: node.mask, left, top });
  const blend = groupType === 1 && node.passThrough ? 'pass' : (PSD_BLEND_KEYS[node.blend || 'source-over'] || 'norm');
  const flags = (forceHidden || node.visible === false ? 0x02 : 0) | (node.protectAlpha ? 0x01 : 0);
  const record = joinBytes(
    bei32(top), bei32(left), bei32(top + height), bei32(left + width), be16(channels.length),
    ...channels.map(channel => joinBytes(bei16(channel.id), psb ? be64(channel.bytes.length) : be32(channel.bytes.length))),
    new TextEncoder().encode('8BIM'), new TextEncoder().encode(blend),
    Uint8Array.of(Math.round(Math.max(0, Math.min(1, Number(node.opacity ?? 1))) * 255), node.clipping ? 1 : 0, flags, 0),
    be32(extra.length), extra
  );
  return { record, channels: channels.map(channel => channel.bytes) };
}
function rasterizeTextLayer(node, width, height) {
  const canvas = makeCanvas(width, height), ctx = canvas.getContext('2d');
  ctx.save();
  ctx.translate(Number(node.x || 0), Number(node.y || 0));
  ctx.rotate(Number(node.rotation || 0) * Math.PI / 180);
  ctx.scale(Number(node.scaleX ?? 1), Number(node.scaleY ?? 1));
  ctx.fillStyle = node.color || '#111111';
  ctx.font = `${node.fontStyle || 'normal'} ${node.fontWeight || 'normal'} ${Math.max(1, Number(node.fontSize || 48))}px ${node.fontFamily || 'Arial'}`;
  ctx.textAlign = node.textAlign || 'left'; ctx.textBaseline = 'top';
  const lineHeight = Math.max(1, Number(node.fontSize || 48)) * 1.2;
  String(node.text || '').split('\n').forEach((line, index) => ctx.fillText(line, 0, index * lineHeight, width * 4));
  ctx.restore();
  return { ...node, type: 'raster', canvas, mask: null, x: 0, y: 0 };
}

function flattenPsdNodes(nodes, parentId = null, output = [], docWidth = 0, docHeight = 0, stats = { textRasterized: 0, adjustmentsBaked: 0 }, forceHidden = false, colorMode = 'RGB', psb = false) {
  const children = nodes.filter(node => (node.parentId ?? null) === (parentId ?? null));
  for (const node of [...children].reverse()) {
    if (node.type === 'group') {
      output.push(makePsdLayerRecord(node, { groupType: 3, forceHidden, colorMode, psb }));
      flattenPsdNodes(nodes, node.id, output, docWidth, docHeight, stats, forceHidden, colorMode, psb);
      output.push(makePsdLayerRecord(node, { groupType: 1, forceHidden, colorMode, psb }));
    } else if (node.type === 'raster') {
      if (node.mask && (node.mask.width !== node.canvas.width || node.mask.height !== node.canvas.height)) throw new Error(`A máscara da camada "${node.name}" não tem as mesmas dimensões do raster; exportação interrompida para evitar um PSD incorreto.`);
      output.push(makePsdLayerRecord(node, { forceHidden, colorMode, psb }));
    } else if (node.type === 'text') {
      output.push(makePsdLayerRecord(rasterizeTextLayer(node, docWidth, docHeight), { forceHidden, colorMode, psb }));
      stats.textRasterized++;
    } else if (node.type === 'adjustment') {
      stats.adjustmentsBaked++;
    }
  }
  return output;
}

export function encodeLayeredPsd(doc, compositeCanvas, { psb = false } = {}) {
  if (!doc || !compositeCanvas) throw new Error('Não há documento composto para exportar.');
  if (!psb && (doc.width > 30000 || doc.height > 30000)) throw new Error('PSD suporta até 30.000 px por lado nesta versão. Use PSB para documentos maiores.');
  assertExportMemoryBudget(doc);
  const stats = { textRasterized: 0, adjustmentsBaked: 0 };
  const hasAdjustments = (doc.layers || []).some(node => node.type === 'adjustment');
  const colorMode = doc.colorMode === 'GRAY' ? 'GRAY' : 'RGB';
  const layerEntries = flattenPsdNodes(doc.layers || [], null, [], doc.width, doc.height, stats, hasAdjustments, colorMode, psb);
  if (hasAdjustments) {
    layerEntries.push(makePsdLayerRecord({ id: 'mcut-merged-adjustments', type: 'raster', name: 'Composto visível — ajustes rasterizados', canvas: compositeCanvas, mask: null, x: 0, y: 0, visible: true, opacity: 1, blend: 'source-over' }, { colorMode, psb }));
  }
  if (!layerEntries.length) throw new Error('Não há camadas raster/grupos exportáveis neste documento.');
  if (layerEntries.length > MAX_LAYER_RECORDS) throw new Error(`O documento excede ${MAX_LAYER_RECORDS} registros PSD.`);
  const records = layerEntries.map(entry => entry.record);
  const channelData = layerEntries.flatMap(entry => entry.channels);
  let layerInfo = joinBytes(bei16(layerEntries.length), ...records, ...channelData);
  if (layerInfo.length % 2) layerInfo = joinBytes(layerInfo, Uint8Array.of(0));
  const layerMask = psb ? joinBytes(be64(layerInfo.length), layerInfo, be32(0)) : joinBytes(be32(layerInfo.length), layerInfo, be32(0));
  const composite = compositeCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, doc.width, doc.height);
  const compositePlanes = colorMode === 'GRAY'
    ? [grayscalePlane(compositeCanvas), Uint8Array.from({ length: doc.width * doc.height }, (_, p) => composite.data[p * 4 + 3])]
    : [0, 1, 2, 3].map(channel => {
      const plane = new Uint8Array(doc.width * doc.height);
      for (let i = 0, p = 0; i < composite.data.length; i += 4, p++) plane[p] = composite.data[i + channel];
      return plane;
    });
  const header = new Uint8Array(26), view = new DataView(header.buffer);
  header.set(new TextEncoder().encode('8BPS'), 0); view.setUint16(4, psb ? 2 : 1, false);
  view.setUint16(12, colorMode === 'GRAY' ? 2 : 4, false); view.setUint32(14, doc.height, false); view.setUint32(18, doc.width, false);
  view.setUint16(22, 8, false); view.setUint16(24, colorMode === 'GRAY' ? 1 : 3, false);
  const bytes = joinBytes(header, be32(0), be32(0), psb ? be64(layerMask.length) : be32(layerMask.length), layerMask, be16(0), ...compositePlanes);
  bytes.exportStats = stats;
  return bytes;
}

export function encodePsd(imageData, { psb = false, colorMode = 'RGB' } = {}) {
  const { width, height, data } = imageData;
  const gray = colorMode === 'GRAY';
  if (!width || !height || width * height > MAX_CHANNEL_PIXELS) throw new Error('Dimensões excedem o limite técnico de pixels para exportação nesta versão.');
  const estimatedBytes = width * height * 8;
  if (!Number.isSafeInteger(estimatedBytes) || estimatedBytes > MAX_PSD_EXPORT_MEMORY_BYTES) throw new Error('Exportação achatada cancelada: a estimativa de memória ultrapassa o orçamento de 512 MB.');
  if (!psb && (width > 30000 || height > 30000)) throw new Error('PSD suporta até 30.000 px por lado nesta versão. Use PSB.');
  const headerSize = 26, sectionsSize = psb ? 4 + 4 + 8 : 4 + 4 + 4;
  const channels = gray ? 2 : 4;
  const output = new Uint8Array(headerSize + sectionsSize + 2 + width * height * channels);
  const view = new DataView(output.buffer);
  let o = 0;
  output.set(new TextEncoder().encode(SIGNATURE), o); o += 4;
  view.setUint16(o, psb ? 2 : 1, false); o += 2;
  o += 6;
  view.setUint16(o, channels, false); o += 2;
  view.setUint32(o, height, false); o += 4;
  view.setUint32(o, width, false); o += 4;
  view.setUint16(o, 8, false); o += 2;
  view.setUint16(o, gray ? 1 : 3, false); o += 2;
  view.setUint32(o, 0, false); o += 4;
  view.setUint32(o, 0, false); o += 4;
  if (psb) { view.setBigUint64(o, 0n, false); o += 8; } else { view.setUint32(o, 0, false); o += 4; }
  view.setUint16(o, 0, false); o += 2;
  const plane = width * height;
  if (gray) {
    for (let i = 0; i < plane; i++) output[o++] = Math.round(data[i * 4] * 0.2126 + data[i * 4 + 1] * 0.7152 + data[i * 4 + 2] * 0.0722);
    for (let i = 0; i < plane; i++) output[o++] = data[i * 4 + 3];
  } else {
    for (let channel = 0; channel < 4; channel++) for (let i = 0; i < plane; i++) output[o++] = data[i * 4 + channel];
  }
  return output;
}

export function exportPsd(doc, compositeCanvas, { psb = false } = {}) {
  if (!doc || !compositeCanvas) throw new Error('Não há documento composto para exportar.');
  assertExportMemoryBudget(doc, { psb });
  let bytes;
  bytes = encodeLayeredPsd(doc, compositeCanvas, { psb });
  const extension = psb ? 'psb' : 'psd';
  const filename = `${doc.name.replace(/\.[^.]+$/, '') || 'MangaCut'}.${extension}`;
  downloadBlob(new Blob([bytes], { type: 'application/octet-stream' }), filename);
  const skippedLayers = psb ? 0 : (doc.layers || []).filter(node => !['raster', 'group', 'text', 'adjustment'].includes(node.type)).length;
  return { filename, bytes: bytes.length, layered: true, skippedLayers, textRasterized: bytes.exportStats?.textRasterized || 0, adjustmentsBaked: bytes.exportStats?.adjustmentsBaked || 0 };
}
