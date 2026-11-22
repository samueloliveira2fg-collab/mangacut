import { $, state, toast, setDirty, makeCanvas } from './core/state.js';
import { createDocument, createLayer, createGroup, createAdjustmentLayer, createTextLayer, activeNode, getActiveRaster, addNode, addMask, childrenOf, cloneDocument, findNode, saveAlphaChannel, estimateCanvasMemory, formatBytes } from './core/document.js';
import { History } from './core/history.js';
import { compositeDocument } from './render/compositor.js';
import { importImages, exportPng } from './io/images.js';
import { openProjectFile, saveProjectFile } from './io/project.js';
import { clearSelection, makeRectSelection, makeEllipseSelection, makeLassoSelection, magicWand, quickSelect, invertSelection, featherSelection, refineSelection, selectAll } from './tools/selection.js';
import { PaintController } from './tools/painting.js';
import { CloneController } from './tools/clone.js';
import { HealingController } from './tools/healing.js';
import { applyFilter } from './tools/filters.js';
import { renderLayersPanel, updateLayerProperties, selectLayer } from './ui/layers-panel.js';
import { bindMenus } from './ui/menus.js';
import { importPsdFile, exportPsd } from './io/psd.js';
import { saveRecoveryPoint, loadRecoveryPoint } from './io/autosave.js';
import { createPath, addAnchor, updateAnchor, exportPathsSvg } from './tools/paths.js';

const preview = $('previewCanvas');
const previewCtx = preview.getContext('2d');
const stage = $('canvasStage');
const scroll = $('canvasScroll');
const area = $('canvasArea');
const welcome = $('welcome');
const selectionBox = $('selectionBox');
const selectionOverlay = $('selectionOverlay');
const selectionOutlineCache = new WeakMap();
state.paths = []; state.activePath = null; state.pathDrag = null;
const transformOverlay = $('transformOverlay');
const toolInfo = {
  move: 'Mover · Arraste a camada ativa', marquee: 'Seleção retangular · Arraste para selecionar pixels',
  ellipse: 'Seleção elíptica · Arraste para selecionar uma área oval', lasso: 'Laço · Desenhe livremente o contorno da seleção',
  quick: 'Seleção rápida · Clique e expanda sobre uma área de cor semelhante', wand: 'Varinha mágica · Clique em uma região de cor semelhante', brush: 'Pincel · Pinte na camada ou máscara ativa',
  eraser: 'Borracha · Apague pixels ou reduza a máscara', text: 'Texto · Clique para inserir texto rasterizado',
  clone: 'Carimbo de clonagem · Alt+clique define a origem; pinte para copiar pixels', healing: 'Healing · Alt+clique define a origem; pinte para mesclar textura e tom', transform: 'Transformação livre · Arraste as alças para escala e rotação', hand: 'Mão · Arraste para navegar', path: 'Caneta · Clique para criar nós; arraste para alças Bézier; clique no primeiro nó para fechar; Enter finaliza'
};

state.history = new History(6);

function checkpoint(label) {
  const saved = state.history.checkpoint(state.doc, label);
  if (!saved && state.doc) {
    state.history.reset();
    toast('Histórico desativado para este documento: o tamanho excede o limite seguro de memória.');
  }
  return saved;
}
let autosaveTimer = null;
function queueAutosave() {
  clearTimeout(autosaveTimer);
  if (!state.doc) return;
  autosaveTimer = setTimeout(async () => {
    try { await saveRecoveryPoint(state.doc); $('saveState').textContent = 'Recuperação automática salva'; }
    catch (error) { console.warn('Autosave indisponível:', error); $('saveState').textContent = 'Autosave indisponível'; }
  }, 1800);
}
function commit(label = 'Alteração') {
  render(); renderLayers(); updateProperties(); setDirty(true); queueAutosave();
  $('docInfo').textContent = `${state.doc.width} × ${state.doc.height} px · ${state.doc.colorMode} · ${state.doc.bitDepth} bits`;
  $('memoryInfo').textContent = `Canvas 2D · Histórico ${state.history.undoStack.length} ações · ${(state.history.retainedBytes / 1048576).toFixed(1)} MB`;
}
function render() {
  if (!state.doc) return;
  compositeDocument(state.doc, preview);
  preview.style.width = `${Math.round(state.doc.width * state.zoom)}px`;
  preview.style.height = `${Math.round(state.doc.height * state.zoom)}px`;
  stage.style.width = preview.style.width; stage.style.height = preview.style.height;
  updateSelectionOverlay();
  updateTransformOverlay();
}
function renderLayers() { renderLayersPanel({ render, updateProperties, checkpoint, commit, select: id => selectNode(id) }); }
function updateProperties() { updateLayerProperties(); }
function markSaved(message = 'Salvo') { setDirty(false); $('saveState').textContent = message; }
function showDocument() {
  welcome.classList.add('hidden'); scroll.classList.remove('hidden');
  $('docTab').textContent = state.doc.name;
  $('docInfo').textContent = `${state.doc.width} × ${state.doc.height} px · ${state.doc.colorMode} · ${state.doc.bitDepth} bits`;
  setZoom(state.zoom); render(); renderLayers(); updateProperties(); fit();
}
function setZoom(value) {
  state.zoom = Math.max(0.1, Math.min(3, Number(value) || 0.7));
  $('zoomRange').value = Math.round(state.zoom * 100);
  $('zoomText').textContent = `${Math.round(state.zoom * 100)}%`;
  if (state.doc) {
    preview.style.width = `${Math.round(state.doc.width * state.zoom)}px`;
    preview.style.height = `${Math.round(state.doc.height * state.zoom)}px`;
    stage.style.width = preview.style.width; stage.style.height = preview.style.height;
  }
}
function fit() {
  if (!state.doc) return;
  const pad = 72;
  setZoom(Math.max(0.1, Math.min(3, (area.clientWidth - pad) / state.doc.width, (area.clientHeight - pad) / state.doc.height)));
  requestAnimationFrame(() => {
    scroll.scrollLeft = Math.max(0, (scroll.scrollWidth - scroll.clientWidth) / 2);
    scroll.scrollTop = Math.max(0, (scroll.scrollHeight - scroll.clientHeight) / 2);
  });
}
function updateSelectionOverlay() {
  if (!state.doc) return;
  if (selectionOverlay.width !== state.doc.width) selectionOverlay.width = state.doc.width;
  if (selectionOverlay.height !== state.doc.height) selectionOverlay.height = state.doc.height;
  selectionOverlay.style.width = preview.style.width; selectionOverlay.style.height = preview.style.height;
  const overlayCtx = selectionOverlay.getContext('2d'); overlayCtx.clearRect(0, 0, selectionOverlay.width, selectionOverlay.height);
  const rect = state.selectionRect;
  if (state.selectionMask) {
    const w = state.doc.width, h = state.doc.height;
    let outlineCanvas = selectionOutlineCache.get(state.selectionMask);
    if (!outlineCanvas && w * h <= 12_000_000) {
      outlineCanvas = makeCanvas(w, h);
      const mask = state.selectionMask.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
      const outline = outlineCanvas.getContext('2d').createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (!mask[i * 4 + 3]) continue;
        const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1 || !mask[(i - 1) * 4 + 3] || !mask[(i + 1) * 4 + 3] || !mask[(i - w) * 4 + 3] || !mask[(i + w) * 4 + 3];
        if (edge) { const j = i * 4, white = ((x + y) % 8) < 4; outline.data[j] = outline.data[j + 1] = outline.data[j + 2] = white ? 255 : 12; outline.data[j + 3] = 255; }
      }
      outlineCanvas.getContext('2d').putImageData(outline, 0, 0);
      selectionOutlineCache.set(state.selectionMask, outlineCanvas);
    }
    if (outlineCanvas) overlayCtx.drawImage(outlineCanvas, 0, 0);
  }
  drawPathOverlay(overlayCtx);
  if (!rect || !state.selectionStart || !['marquee', 'ellipse'].includes(state.tool)) { selectionBox.classList.add('hidden'); return; }
  selectionBox.classList.remove('hidden');
  selectionBox.style.left = `${rect.x / state.doc.width * 100}%`;
  selectionBox.style.top = `${rect.y / state.doc.height * 100}%`;
  selectionBox.style.width = `${rect.width / state.doc.width * 100}%`;
  selectionBox.style.height = `${rect.height / state.doc.height * 100}%`;
  selectionBox.style.borderRadius = state.tool === 'ellipse' ? '50%' : '0';
}
function drawPathOverlay(ctx) {
  const paths = [...state.paths, ...(state.activePath ? [state.activePath] : [])];
  if (!state.doc || !paths.length) return;
  ctx.save(); ctx.lineWidth = Math.max(1, 1.5 / state.zoom); ctx.strokeStyle = '#00a8ff'; ctx.fillStyle = '#ffffff';
  for (const path of paths) {
    const pts = path.segments;
    if (!pts.length) continue;
    ctx.beginPath(); ctx.moveTo(pts[0].anchor.x, pts[0].anchor.y);
    const count = path.closed ? pts.length : pts.length - 1;
    for (let i = 0; i < count; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (a.out || b.in) { const c1 = a.out || a.anchor, c2 = b.in || b.anchor; ctx.bezierCurveTo(c1.x,c1.y,c2.x,c2.y,b.anchor.x,b.anchor.y); }
      else ctx.lineTo(b.anchor.x,b.anchor.y);
    }
    ctx.stroke();
    for (const seg of pts) {
      for (const handle of [seg.in, seg.out]) if (handle) { ctx.beginPath(); ctx.moveTo(seg.anchor.x,seg.anchor.y); ctx.lineTo(handle.x,handle.y); ctx.strokeStyle='#ffb84d'; ctx.stroke(); ctx.beginPath(); ctx.arc(handle.x,handle.y,3/state.zoom,0,Math.PI*2); ctx.fillStyle='#ffb84d'; ctx.fill(); }
      ctx.beginPath(); ctx.arc(seg.anchor.x,seg.anchor.y,4/state.zoom,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill(); ctx.strokeStyle='#0077bb'; ctx.stroke();
    }
  }
  ctx.restore();
}
function finishPath() {
  if (!state.activePath) return;
  if (state.activePath.segments.length < 2) { state.activePath = null; render(); return; }
  state.paths.push(state.activePath); state.activePath = null; render(); toast('Caminho vetorial finalizado. Exporte em Arquivo > Exportar caminhos SVG.');
}
function exportVectorPaths() {
  const paths = [...state.paths, ...(state.activePath ? [state.activePath] : [])];
  if (!state.doc || !paths.length) return toast('Desenhe ao menos um caminho com a Caneta.');
  const svg = exportPathsSvg(paths, { width: state.doc.width, height: state.doc.height });
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `${state.doc.name || 'mangacut'}-caminhos.svg`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); toast('SVG dos caminhos exportado.');
}
function updateTransformOverlay() {
  const node = activeNode();
  if (!state.doc || state.tool !== 'transform' || !node || !['raster', 'text'].includes(node.type)) {
    transformOverlay.classList.add('hidden'); return;
  }
  let x, y, width, height, rotation;
  if (node.type === 'raster') {
    const sx = Math.abs(Number(node.scaleX ?? 1)), sy = Math.abs(Number(node.scaleY ?? 1));
    x = state.doc.width / 2 + ((node.x || 0) - state.doc.width / 2) * Number(node.scaleX ?? 1);
    y = state.doc.height / 2 + ((node.y || 0) - state.doc.height / 2) * Number(node.scaleY ?? 1);
    width = node.canvas.width * sx; height = node.canvas.height * sy; rotation = Number(node.rotation || 0);
  } else {
    previewCtx.save();
    previewCtx.font = `${node.fontStyle || 'normal'} ${node.fontWeight || 'normal'} ${node.fontSize || 48}px ${node.fontFamily || 'Arial'}`;
    const lines = String(node.text || '').split('\n');
    width = Math.max(24, ...lines.map(line => previewCtx.measureText(line).width)) * Math.abs(Number(node.scaleX ?? 1));
    previewCtx.restore();
    height = Math.max(1, lines.length) * (Number(node.fontSize || 48) * 1.2) * Math.abs(Number(node.scaleY ?? 1));
    x = node.x || 0; y = node.y || 0; rotation = Number(node.rotation || 0);
  }
  transformOverlay.style.left = `${x * state.zoom}px`;
  transformOverlay.style.top = `${y * state.zoom}px`;
  transformOverlay.style.width = `${Math.max(8, width * state.zoom)}px`;
  transformOverlay.style.height = `${Math.max(8, height * state.zoom)}px`;
  transformOverlay.style.transformOrigin = node.type === 'raster' ? 'center center' : 'top left';
  transformOverlay.style.transform = `rotate(${rotation}deg)`;
  transformOverlay.classList.remove('hidden');
}

function selectNode(id) {
  state.doc.activeId = id; state.editMask = false;
  renderLayers(); updateProperties(); render();
}
function setTool(tool) {
  state.tool = tool;
  document.querySelectorAll('.tool').forEach(button => button.classList.toggle('active', button.dataset.tool === tool));
  $('toolContext').textContent = toolInfo[tool] || tool;
  area.style.cursor = tool === 'hand' ? 'grab' : ['brush', 'eraser', 'clone', 'healing', 'marquee', 'ellipse', 'lasso', 'quick', 'wand', 'path'].includes(tool) ? 'crosshair' : tool === 'text' ? 'text' : ['move','transform'].includes(tool) ? 'move' : 'default';
  updateTransformOverlay();
}
function newDocument() {
  try {
    state.doc = createDocument(Number($('newWidth').value), Number($('newHeight').value), $('newName').value || 'Sem título-1', $('newBackground').value);
    state.history.reset(); clearSelection(); state.editMask = false;
    showDocument(); markSaved('Novo documento');
    const estimate = estimateCanvasMemory(state.doc.width, state.doc.height);
    const notice = estimate >= 128 * 1024 * 1024 ? ` Atenção: uma camada raster vazia pode ocupar cerca de ${formatBytes(estimate)}; evite muitas camadas simultâneas.` : '';
    toast(`Documento criado: ${state.doc.width} × ${state.doc.height} px.${notice}`, 6000);
  } catch (error) { toast(error.message); }
}
function addBlankLayer() {
  if (!state.doc) return toast('Crie ou abra um documento primeiro.');
  checkpoint('Nova camada');
  const selected = activeNode();
  const parentId = selected?.type === 'group' ? selected.id : (selected?.parentId ?? null);
  addNode(state.doc, createLayer(state.doc, `Camada ${state.doc.layers.filter(n => n.type === 'raster').length + 1}`, null, parentId));
  commit('Nova camada');
}
function addLayerGroup() {
  if (!state.doc) return toast('Crie ou abra um documento primeiro.');
  checkpoint('Novo grupo');
  const selected = activeNode();
  const parentId = selected?.type === 'group' ? (selected.parentId ?? null) : (selected?.parentId ?? null);
  addNode(state.doc, createGroup(`Grupo ${state.doc.layers.filter(n => n.type === 'group').length + 1}`, parentId));
  commit('Novo grupo');
}
function addAdjustment() {
  if (!state.doc) return toast('Crie ou abra um documento primeiro.');
  const choice = prompt('Tipo de ajuste: brightnessContrast, invert, grayscale, sepia, threshold ou posterize', 'brightnessContrast');
  const allowed = ['brightnessContrast','invert','grayscale','sepia','threshold','posterize'];
  if (!allowed.includes(choice)) return toast('Tipo de ajuste não reconhecido.');
  checkpoint('Nova camada de ajuste');
  const selected = activeNode();
  const parentId = selected?.type === 'group' ? selected.id : (selected?.parentId ?? null);
  addNode(state.doc, createAdjustmentLayer(`${choice} ${state.doc.layers.filter(n => n.type === 'adjustment').length + 1}`, choice, parentId));
  commit('Nova camada de ajuste');
}
function saveCurrentSelection() {
  if (!state.doc || !state.selectionMask) return toast('Não há seleção para salvar.');
  const name = prompt('Nome do canal alfa:', `Alpha ${state.doc.channels.length + 1}`);
  if (!name) return;
  checkpoint('Salvar seleção como canal'); saveAlphaChannel(state.doc, name.trim(), state.selectionMask); commit('Canal alfa salvo');
}
function loadSelectionChannel() {
  const channels = state.doc?.channels || [];
  if (!channels.length) return toast('Este documento não possui canais alfa salvos.');
  const lines = channels.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
  const choice = prompt(`Digite o número do canal para carregar:\n${lines}`, '1');
  const index = Number(choice) - 1;
  if (!Number.isInteger(index) || !channels[index]) return;
  const source = channels[index].canvas, copy = makeCanvas(source.width, source.height);
  copy.getContext('2d').drawImage(source, 0, 0); state.selectionMask = copy;
  state.selectionRect = { x: 0, y: 0, width: copy.width, height: copy.height, channel: true };
  renderSelection(); toast(`Seleção carregada: ${channels[index].name}`);
}
function duplicateActive() {
  const layer = getActiveRaster();
  if (!layer) return toast('Selecione uma camada raster para duplicar.');
  checkpoint('Duplicar camada');
  const clone = createLayer(state.doc, `${layer.name} cópia`, layer.canvas, layer.parentId);
  clone.canvas = cloneCanvas(layer.canvas); clone.mask = layer.mask ? cloneCanvas(layer.mask) : null;
  clone.visible = layer.visible; clone.opacity = layer.opacity; clone.blend = layer.blend;
  clone.x = layer.x; clone.y = layer.y;
  const index = state.doc.layers.indexOf(layer);
  state.doc.layers.splice(index + 1, 0, clone); state.doc.activeId = clone.id;
  commit('Duplicar camada');
}
function cloneCanvas(source) {
  const copy = makeCanvas(source.width, source.height);
  copy.getContext('2d').drawImage(source, 0, 0);
  return copy;
}
function collectSubtreeIds(id) {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of state.doc.layers) if (ids.has(node.parentId) && !ids.has(node.id)) { ids.add(node.id); changed = true; }
  }
  return ids;
}
function deleteActive() {
  const node = activeNode();
  if (!node) return;
  const ids = collectSubtreeIds(node.id);
  const index = state.doc.layers.indexOf(node);
  if (!checkpoint) return;
  if (state.doc.layers.length === ids.size) return toast('O documento precisa manter ao menos uma camada ou grupo.');
  checkpoint('Excluir camada');
  state.doc.layers = state.doc.layers.filter(layer => !ids.has(layer.id));
  state.doc.activeId = state.doc.layers[Math.max(0, index - 1)]?.id || state.doc.layers[0]?.id || null;
  state.editMask = false; commit('Excluir camada');
}
function addLayerMask() {
  const layer = getActiveRaster();
  if (!layer) return toast('Selecione uma camada raster para adicionar uma máscara.');
  if (layer.mask) return toast('Esta camada já possui uma máscara.');
  checkpoint('Adicionar máscara'); addMask(layer, state.doc.width, state.doc.height); state.editMask = true; commit('Máscara adicionada');
}
function removeLayerMask() {
  const layer = getActiveRaster();
  if (!layer?.mask) return toast('A camada selecionada não possui máscara.');
  checkpoint('Remover máscara'); layer.mask = null; state.editMask = false; commit('Máscara removida');
}
function reorderActive(direction) {
  const node = activeNode(); if (!node) return;
  const siblings = childrenOf(node.parentId ?? null);
  const position = siblings.findIndex(item => item.id === node.id);
  const target = siblings[position + direction];
  if (!target) return;
  checkpoint('Reordenar camada');
  const a = state.doc.layers.indexOf(node), b = state.doc.layers.indexOf(target);
  state.doc.layers.splice(a, 1); state.doc.layers.splice(b, 0, node);
  commit('Reordenar camada');
}
function mergeDown() {
  const upper = getActiveRaster(); if (!upper) return toast('Selecione uma camada raster.');
  const siblings = childrenOf(upper.parentId ?? null);
  const pos = siblings.findIndex(item => item.id === upper.id);
  const lower = siblings[pos - 1];
  if (!lower || lower.type !== 'raster') return toast('A camada abaixo precisa ser uma camada raster do mesmo grupo.');
  checkpoint('Mesclar abaixo');
  const temp = makeCanvas(state.doc.width, state.doc.height), tctx = temp.getContext('2d');
  tctx.drawImage(upper.canvas, upper.x, upper.y);
  if (upper.mask) { tctx.globalCompositeOperation = 'destination-in'; tctx.drawImage(upper.mask, upper.x, upper.y); tctx.globalCompositeOperation = 'source-over'; }
  const lctx = lower.canvas.getContext('2d'); lctx.save(); lctx.globalAlpha = upper.opacity; lctx.globalCompositeOperation = upper.blend; lctx.drawImage(temp, -lower.x, -lower.y); lctx.restore();
  state.doc.layers.splice(state.doc.layers.indexOf(upper), 1); state.doc.activeId = lower.id;
  commit('Mesclar abaixo');
}
function getPoint(event) {
  const rect = preview.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * state.doc.width / rect.width, y: (event.clientY - rect.top) * state.doc.height / rect.height };
}
function renderSelection() { render(); updateSelectionOverlay(); }
function addText(point) {
  const value = prompt('Texto da camada editável:'); if (!value) return;
  const size = Number(prompt('Tamanho da fonte (px):', '48'));
  if (!Number.isFinite(size) || size < 1 || size > 1200) return toast('Tamanho de fonte inválido.');
  checkpoint('Adicionar texto');
  const selected = activeNode();
  const parentId = selected?.type === 'group' ? selected.id : selected?.parentId ?? null;
  addNode(state.doc, createTextLayer(state.doc, value, Math.max(0, point.x), Math.max(0, point.y), { fontSize: size, color: state.color, parentId }));
  commit('Texto editável adicionado'); setTool('move');
}

const painter = new PaintController({
  getDocument: () => state.doc, getSelection: () => state.selectionMask,
  checkpoint, recordStroke: (layerId, target, tiles, label) => state.history.recordTileStroke(state.doc, layerId, target, tiles, label),
  commit, render, notify: toast
});
const cloner = new CloneController({ getDocument: () => state.doc, getSelection: () => state.selectionMask, checkpoint, commit, render, notify: toast });
const healer = new HealingController({ getDocument: () => state.doc, getSelection: () => state.selectionMask, recordStroke: (layerId, target, tiles, label) => state.history.recordTileStroke(state.doc, layerId, target, tiles, label), commit, render, notify: toast });

function pointerDown(event) {
  if (!state.doc || (event.button !== 0 && event.button !== 1)) return;
  const transformHandle = event.target.closest?.('[data-transform-handle]');
  if (state.tool === 'transform' && transformHandle) {
    const node = activeNode(); if (!node || !['raster','text'].includes(node.type) || node.locked) return;
    const p = getPoint(event); const center = node.type === 'raster' ? {x:state.doc.width/2,y:state.doc.height/2} : {x:node.x||0,y:node.y||0};
    checkpoint('Transformação livre');
    state.transformDrag = { id:node.id, handle:transformHandle.dataset.transformHandle, start:p, center, scaleX:Number(node.scaleX??1), scaleY:Number(node.scaleY??1), rotation:Number(node.rotation||0), startAngle:Math.atan2(p.y-center.y,p.x-center.x), width:node.type==='raster'?node.canvas.width:Math.max(1,transformOverlay.clientWidth/state.zoom), height:node.type==='raster'?node.canvas.height:Math.max(1,transformOverlay.clientHeight/state.zoom), originalX:Number(node.x||0), originalY:Number(node.y||0) };
    area.setPointerCapture(event.pointerId); event.preventDefault(); return;
  }
  if (state.space || state.tool === 'hand') {
    state.moveStart = { mode: 'pan', x: event.clientX, y: event.clientY, left: scroll.scrollLeft, top: scroll.scrollTop };
    area.setPointerCapture(event.pointerId); return;
  }
  const point = getPoint(event);
  if (state.tool === 'path') {
    if (!state.activePath) state.activePath = createPath({ name: `Caminho ${state.paths.length + 1}` });
    const segments = state.activePath.segments;
    if (segments.length >= 3 && Math.hypot(point.x-segments[0].anchor.x, point.y-segments[0].anchor.y) <= 9/state.zoom) { state.activePath.closed = true; finishPath(); return; }
    state.activePath = addAnchor(state.activePath, point); state.pathDrag = { index: state.activePath.segments.length - 1, start: point };
    area.setPointerCapture(event.pointerId); render(); return;
  }
  const layer = getActiveRaster();
  const selectedNode = activeNode();
  if (state.tool === 'clone' || state.tool === 'healing') {
    const controller = state.tool === 'clone' ? cloner : healer;
    if (event.altKey) { controller.setSource(point); return; }
    controller.begin(point); area.setPointerCapture(event.pointerId); return;
  }
  if (state.tool === 'brush' || state.tool === 'eraser') {
    if (!layer) return toast('Selecione uma camada raster.');
    painter.begin(point, state.tool, event.pointerType === 'mouse' ? 1 : event.pressure);
    state.drawing = painter.active; render(); area.setPointerCapture(event.pointerId); return;
  }
  if (state.tool === 'transform') { updateTransformOverlay(); return; }
  if (state.tool === 'move') {
    if (!selectedNode || !['raster', 'text'].includes(selectedNode.type)) return toast('Selecione uma camada raster ou de texto para mover.');
    if (selectedNode.locked) return toast('Esta camada está bloqueada.');
    checkpoint('Mover camada');
    state.moveStart = { mode: 'layer', x: event.clientX, y: event.clientY, lx: selectedNode.x || 0, ly: selectedNode.y || 0, id: selectedNode.id };
    area.setPointerCapture(event.pointerId); return;
  }
  if (['marquee', 'ellipse', 'lasso'].includes(state.tool)) {
    state.selectionStart = point; state.selectionMode = event.altKey ? 'subtract' : event.shiftKey ? 'add' : event.ctrlKey ? 'intersect' : 'replace';
    state.selectionPoints = [point]; state.selectionRect = { x: point.x, y: point.y, width: 0, height: 0 };
    area.setPointerCapture(event.pointerId); renderSelection(); return;
  }
  if (state.tool === 'wand' || state.tool === 'quick') {
    try {
      const mode = event.altKey ? 'subtract' : event.shiftKey ? 'add' : 'replace';
      const count = state.tool === 'wand'
        ? magicWand(state.doc, preview, point.x, point.y, Number($('wandTolerance').value), { mode })
        : quickSelect(state.doc, preview, point.x, point.y, Number($('wandTolerance').value), state.brushSize * 2, mode);
      toast(`${count.toLocaleString('pt-BR')} pixels adicionados à seleção.`); renderSelection();
    } catch (error) { toast(error.message); }
    return;
  }
  if (state.tool === 'text') addText(point);
}
function pointerMove(event) {
  if (!state.doc) return;
  const p = getPoint(event);
  $('cursorInfo').textContent = `X: ${Math.round(p.x)} · Y: ${Math.round(p.y)}`;
  if (state.pathDrag && state.activePath) { const d=state.pathDrag, dx=p.x-d.start.x, dy=p.y-d.start.y; state.activePath=updateAnchor(state.activePath,d.index,{ in:{x:p.x-dx,y:p.y-dy}, out:{x:p.x+dx,y:p.y+dy}, smooth:true }); render(); return; }
  if (painter.active) { painter.move(p, state.tool, event.pointerType === 'mouse' ? 1 : event.pressure); return; }
  if (cloner.active) { cloner.move(p); return; }
  if (healer.active) { healer.move(p); return; }
  if (state.transformDrag) {
    const drag=state.transformDrag,node=findNode(drag.id); if(!node)return;
    if(drag.handle==='rotate'){const angle=Math.atan2(p.y-drag.center.y,p.x-drag.center.x);node.rotation=drag.rotation+(angle-drag.startAngle)*180/Math.PI;}
    else {
      let sx=drag.scaleX,sy=drag.scaleY;
      if(node.type==='raster'){
        if(drag.handle.includes('e')||drag.handle.includes('w')){const den=drag.start.x-drag.center.x;if(Math.abs(den)>2)sx=drag.scaleX*((p.x-drag.center.x)/den);}
        if(drag.handle.includes('n')||drag.handle.includes('s')){const den=drag.start.y-drag.center.y;if(Math.abs(den)>2)sy=drag.scaleY*((p.y-drag.center.y)/den);}
      }else{
        if(drag.handle.includes('e')||drag.handle.includes('w'))sx=drag.scaleX*Math.max(.05,(drag.width+(p.x-drag.start.x)*(drag.handle.includes('w')?-1:1))/drag.width);
        if(drag.handle.includes('n')||drag.handle.includes('s'))sy=drag.scaleY*Math.max(.05,(drag.height+(p.y-drag.start.y)*(drag.handle.includes('n')?-1:1))/drag.height);
      }
      if(event.shiftKey){const ratio=Math.max(.05,Math.abs(sx/drag.scaleX));sx=drag.scaleX*ratio;sy=drag.scaleY*ratio;}
      node.scaleX=Math.max(-20,Math.min(20,sx));node.scaleY=Math.max(-20,Math.min(20,sy));
    }
    render();return;
  }
  if (state.moveStart?.mode === 'layer') {
    const layer = findNode(state.moveStart.id);
    if (!layer || !['raster', 'text'].includes(layer.type)) return;
    layer.x = state.moveStart.lx + (event.clientX - state.moveStart.x) / state.zoom;
    layer.y = state.moveStart.ly + (event.clientY - state.moveStart.y) / state.zoom;
    render(); return;
  }
  if (state.moveStart?.mode === 'pan') {
    scroll.scrollLeft = state.moveStart.left - (event.clientX - state.moveStart.x);
    scroll.scrollTop = state.moveStart.top - (event.clientY - state.moveStart.y); return;
  }
  if (state.selectionStart) {
    if (state.tool === 'lasso') {
      const last = state.selectionPoints[state.selectionPoints.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) >= 2) state.selectionPoints.push(p);
      const xs = state.selectionPoints.map(v => v.x), ys = state.selectionPoints.map(v => v.y);
      state.selectionRect = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    } else {
      const x = Math.min(state.selectionStart.x, p.x), y = Math.min(state.selectionStart.y, p.y);
      state.selectionRect = { x, y, width: Math.abs(p.x - state.selectionStart.x), height: Math.abs(p.y - state.selectionStart.y) };
    }
    renderSelection();
  }
}
function pointerUp() {
  if (state.pathDrag) { state.pathDrag = null; render(); }
  if (state.transformDrag) { state.transformDrag=null; commit('Transformação livre'); }
  if (healer.active) { healer.end(); renderLayers(); setDirty(true); queueAutosave(); }
  if (cloner.active) { cloner.end(); renderLayers(); setDirty(true); queueAutosave(); }
  if (painter.active) { painter.end(); state.drawing = false; renderLayers(); setDirty(true); queueAutosave(); }
  if (state.moveStart?.mode === 'layer') { state.moveStart = null; commit('Mover camada'); }
  else state.moveStart = null;
  if (state.selectionStart) {
    const rect = state.selectionRect, mode = state.selectionMode || 'replace';
    const points = state.selectionPoints || [];
    state.selectionStart = null; state.selectionPoints = null;
    if (state.tool === 'ellipse') makeEllipseSelection(state.doc, rect.x, rect.y, rect.x + rect.width, rect.y + rect.height, mode);
    else if (state.tool === 'lasso') makeLassoSelection(state.doc, points, mode);
    else makeRectSelection(state.doc, rect.x, rect.y, rect.x + rect.width, rect.y + rect.height, mode);
    state.selectionMode = null; renderSelection();
    if (state.selectionMask) toast(`Seleção aplicada: ${Math.round(rect.width)} × ${Math.round(rect.height)} px`);
  }
}

function parsedImportStatus() { return state.doc?.importInfo?.flattened ? 'PSD composto importado' : 'PSD com camadas importado'; }

async function openFiles(files) {
  try {
    const chosen = [...files];
    if (chosen.length === 1 && /\.(psd|psb)$/i.test(chosen[0].name)) {
      state.doc = await importPsdFile(chosen[0]);
      state.history.reset(); clearSelection(); state.editMask = false; showDocument(); markSaved(parsedImportStatus());
      const info = state.doc.importInfo;
      if (info?.flattened) toast('PSD/PSB aberto como imagem composta. Camadas especiais ainda não são preservadas.');
      else toast(`PSD/PSB aberto com ${state.doc.layers.filter(layer => layer.type === 'raster').length} camadas raster e grupos básicos.`);
      return;
    }
    if (chosen.some(file => /\.(psd|psb)$/i.test(file.name))) throw new Error('Abra arquivos PSD/PSB individualmente. Imagens comuns podem ser abertas em conjunto.');
    state.doc = await importImages(chosen);
    state.history.reset(); clearSelection(); state.editMask = false; showDocument(); markSaved('Imagem aberta');
    toast(`${chosen.length} arquivo(s) aberto(s).`);
  } catch (error) { toast(error.message); }
}
async function openProject(file) {
  try {
    state.doc = await openProjectFile(file);
    state.history.reset(); await saveRecoveryPoint(state.doc).catch(() => {}); clearSelection(); state.editMask = false; showDocument(); markSaved('Projeto aberto'); toast('Projeto MCUT aberto.');
  } catch (error) { toast(`Não foi possível abrir o projeto: ${error.message}`); }
}
function exportComposite() {
  if (!state.doc) return toast('Nenhum documento aberto.');
  render(); exportPng(state.doc, preview); $('saveState').textContent = 'PNG exportado';
}
function undo() {
  if (!state.doc) return;
  const restored = state.history.undo(state.doc);
  if (!restored) return toast('Nada para desfazer.');
  state.doc = restored; state.editMask = false; render(); renderLayers(); updateProperties(); setDirty(true); toast('Desfeito.');
}
function redo() {
  if (!state.doc) return;
  const restored = state.history.redo(state.doc);
  if (!restored) return toast('Nada para refazer.');
  state.doc = restored; state.editMask = false; render(); renderLayers(); updateProperties(); setDirty(true); toast('Refeito.');
}
function runAction(action) {
  switch (action) {
    case 'new': $('newModal').classList.remove('hidden'); break;
    case 'open': $('fileInput').click(); break;
    case 'openProject': $('projectInput').click(); break;
    case 'saveProject': if (state.doc) { saveProjectFile(state.doc); markSaved('Projeto MCUT salvo'); saveRecoveryPoint(state.doc).catch(() => {}); } else toast('Nenhum documento aberto.'); break;
    case 'exportPsd': if (state.doc) { try { const result = exportPsd(state.doc, preview); markSaved(`PSD exportado · ${Math.round(result.bytes / 1024)} KB`); toast(result.layered ? `PSD com camadas e grupos.${result.textRasterized ? ` ${result.textRasterized} texto(s) rasterizado(s).` : ''}${result.adjustmentsBaked ? ` ${result.adjustmentsBaked} ajuste(s) foram incorporados ao composto visível; fontes originais ficaram ocultas para preservar a aparência.` : ''}${result.skippedLayers ? ` ${result.skippedLayers} camada(s) especial(is) não foram exportadas.` : ''}` : 'PSB exportado como imagem composta achatada.'); } catch (error) { toast(error.message); } } else toast('Nenhum documento aberto.'); break;
    case 'exportPsb': if (state.doc) { try { const result = exportPsd(state.doc, preview, { psb: true }); markSaved(`PSB exportado · ${Math.round(result.bytes / 1024)} KB`); toast('PSB exportado como imagem composta achatada.'); } catch (error) { toast(error.message); } } else toast('Nenhum documento aberto.'); break;
    case 'export': exportComposite(); break;
    case 'exportPaths': exportVectorPaths(); break;
    case 'undo': undo(); break;
    case 'redo': redo(); break;
    case 'newLayer': addBlankLayer(); break;
    case 'newGroup': addLayerGroup(); break;
    case 'newAdjustment': addAdjustment(); break;
    case 'addMask': addLayerMask(); break;
    case 'duplicate': duplicateActive(); break;
    case 'delete': deleteActive(); break;
    case 'merge': mergeDown(); break;
    case 'fit': fit(); break;
    case 'zoom100': setZoom(1); break;
    case 'zoom50': setZoom(0.5); break;
    case 'marquee': setTool('marquee'); break;
    case 'wand': setTool('wand'); break;
    case 'ellipse': setTool('ellipse'); break;
    case 'lasso': setTool('lasso'); break;
    case 'quick': setTool('quick'); break;
    case 'selectAll': if (state.doc) { selectAll(state.doc); renderSelection(); } break;
    case 'invertSelection': if (state.doc && invertSelection(state.doc)) renderSelection(); break;
    case 'featherSelection': if (state.doc && state.selectionMask) { const radius = Number(prompt('Raio de suavização da seleção (px):', '2')); if (Number.isFinite(radius) && featherSelection(radius)) renderSelection(); } else toast('Crie uma seleção primeiro.'); break;
    case 'refineSelection': if (state.doc && state.selectionMask) { const radius=Number(prompt('Raio de refinamento (px):','2')); const contrast=Number(prompt('Contraste de borda (0.02 a 0.48):','0.18')); if(Number.isFinite(radius)&&Number.isFinite(contrast)&&refineSelection(radius,contrast))renderSelection(); } else toast('Crie uma seleção primeiro.'); break;
    case 'saveSelection': saveCurrentSelection(); break;
    case 'loadSelection': loadSelectionChannel(); break;
    case 'clearSelection': clearSelection(); selectionBox.classList.add('hidden'); render(); toast('Seleção removida.'); break;
    case 'grayscale': applyFilter('grayscale', filterContext()); break;
    case 'invert': applyFilter('invert', filterContext()); break;
    case 'brightness': applyFilter('brightness', filterContext()); break;
    case 'blur': applyFilter('blur', filterContext()); break;
    case 'help': $('helpModal').classList.remove('hidden'); break;
    case 'license': window.open('LICENSE', '_blank', 'noopener'); break;
    case 'about': toast('MangaCut Studio 2.0 · Editor independente em desenvolvimento · AGPL-3.0-only'); break;
  }
}
function filterContext() { return { doc: state.doc, checkpoint, render, commit, notify: toast }; }
function bind() {
  $('openWelcome').onclick = () => $('fileInput').click();
  $('newWelcome').onclick = () => $('newModal').classList.remove('hidden');
  $('newDocTab').onclick = () => $('newModal').classList.remove('hidden');
  $('createDoc').onclick = () => { newDocument(); $('newModal').classList.add('hidden'); };
  $('fileInput').onchange = event => { openFiles(event.target.files); event.target.value = ''; };
  $('projectInput').onchange = event => { if (event.target.files[0]) openProject(event.target.files[0]); event.target.value = ''; };
  $('addLayer').onclick = addBlankLayer; $('addGroup').onclick = addLayerGroup; $('addAdjustment').onclick = addAdjustment;
  $('addImageLayer').onclick = () => $('fileInput').click(); $('addMask').onclick = addLayerMask; $('deleteMask').onclick = removeLayerMask;
  $('duplicateLayer').onclick = duplicateActive; $('deleteLayer').onclick = deleteActive;
  $('moveLayerUp').onclick = () => reorderActive(1); $('moveLayerDown').onclick = () => reorderActive(-1); $('mergeDown').onclick = mergeDown;
  $('layerName').onchange = event => { const node = activeNode(); if (!node) return; checkpoint('Renomear camada'); node.name = event.target.value || 'Camada'; commit('Renomear camada'); };
  $('layerOpacity').onchange = event => { const node = activeNode(); if (!node) return; checkpoint('Opacidade'); node.opacity = Number(event.target.value) / 100; commit('Opacidade'); };
  for (const [id, key] of [['layerX','x'],['layerY','y'],['layerScaleX','scaleX'],['layerScaleY','scaleY'],['layerRotation','rotation']]) $(id).onchange = event => { const node = activeNode(); if (!node || node.type === 'group' || node.type === 'adjustment') return; const value = Number(event.target.value); if (!Number.isFinite(value)) return; checkpoint('Transformação'); node[key] = key.startsWith('scale') ? Math.max(-20, Math.min(20, value)) : key === 'rotation' ? ((value % 360) + 360) % 360 : Math.round(value); commit('Transformação'); };
  $('layerFlipH').onclick = () => { const node = activeNode(); if (!node || node.type === 'group' || node.type === 'adjustment') return; checkpoint('Espelhar horizontal'); node.scaleX = -Number(node.scaleX ?? 1); commit('Espelhar horizontal'); updateProperties(); };
  $('layerFlipV').onclick = () => { const node = activeNode(); if (!node || node.type === 'group' || node.type === 'adjustment') return; checkpoint('Espelhar vertical'); node.scaleY = -Number(node.scaleY ?? 1); commit('Espelhar vertical'); updateProperties(); };
  $('editTextLayer').onclick = () => { const node = activeNode(); if (node?.type !== 'text') return toast('Selecione uma camada de texto editável.'); const value = prompt('Editar conteúdo do texto:', node.text); if (value === null) return; checkpoint('Editar texto'); node.text = value; node.name = `Texto: ${value.slice(0,22)}`; commit('Texto editado'); };
  for (const [id, key] of [['textFontFamily','fontFamily'],['textFontSize','fontSize'],['textColor','color'],['textWeight','fontWeight']]) $(id).onchange = event => { const node = activeNode(); if (node?.type !== 'text') return; checkpoint('Formatar texto'); node[key] = key === 'fontSize' ? Math.max(1, Math.min(1200, Number(event.target.value) || 48)) : event.target.value; commit('Texto formatado'); };
  $('blendMode').onchange = event => { const node = activeNode(); if (!node) return; checkpoint('Modo de mesclagem'); node.blend = event.target.value; commit('Modo de mesclagem'); };
  $('editMask').onchange = event => { state.editMask = event.target.checked; toast(state.editMask ? 'Editando máscara.' : 'Editando pixels.'); };
  $('brushSize').oninput = event => { state.brushSize = Number(event.target.value); $('brushValue').textContent = `${state.brushSize} px`; };
  $('brushOpacity').oninput = event => { state.brushOpacity = Number(event.target.value) / 100; $('brushOpacityValue').textContent = `${event.target.value}%`; };
  $('wandTolerance').oninput = event => { $('wandValue').textContent = event.target.value; };
  for (const [id, key] of [['adjBrightness', 'brightness'], ['adjContrast', 'contrast'], ['adjSaturation', 'saturation']]) $(id).onchange = event => { const node = activeNode(); if (node?.type !== 'adjustment') return; checkpoint('Ajuste de camada'); node.params[key] = Number(event.target.value); $(`${id}Value`).textContent = event.target.value; commit('Ajuste atualizado'); };
  $('saveSelection').onclick = saveCurrentSelection; $('loadSelection').onclick = loadSelectionChannel;
  $('fgColor').oninput = event => { state.color = event.target.value; };
  $('resetColor').onclick = () => { $('fgColor').value = '#000000'; state.color = '#000000'; };
  $('zoomRange').oninput = event => setZoom(Number(event.target.value) / 100); $('fitBtn').onclick = fit;
  $('helpBtn').onclick = () => $('helpModal').classList.remove('hidden');
  document.querySelectorAll('.tool').forEach(button => button.onclick = () => setTool(button.dataset.tool));
  document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => $(button.dataset.close).classList.add('hidden'));
  document.querySelectorAll('.panel-tab').forEach(button => button.onclick = () => {
    document.querySelectorAll('.panel-tab').forEach(item => item.classList.toggle('active', item === button));
    $('layersPanel').classList.toggle('hidden', button.dataset.panel !== 'layers');
    $('propertiesPanel').classList.toggle('hidden', button.dataset.panel !== 'properties');
  });
  area.addEventListener('pointerdown', pointerDown); area.addEventListener('pointermove', pointerMove);
  area.addEventListener('pointerup', pointerUp); area.addEventListener('pointercancel', pointerUp);
  area.addEventListener('dragover', event => { event.preventDefault(); $('dropHint').classList.remove('hidden'); });
  area.addEventListener('dragleave', () => $('dropHint').classList.add('hidden'));
  area.addEventListener('drop', event => { event.preventDefault(); $('dropHint').classList.add('hidden'); if (event.dataTransfer.files.length) openFiles(event.dataTransfer.files); });
  bindMenus(runAction);
  document.addEventListener('keydown', event => {
    if (event.target.matches('input,select,textarea')) return;
    if (event.code === 'Space') { state.space = true; area.style.cursor = 'grab'; event.preventDefault(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') { event.preventDefault(); $('fileInput').click(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === 's') { event.preventDefault(); runAction('saveProject'); return; }
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.shiftKey && event.key.toLowerCase() === 's') { event.preventDefault(); exportComposite(); return; }
    const map = { p: 'path', c: 'clone', j: 'healing', v: 'move', m: 'marquee', w: 'wand', q: 'quick', l: 'lasso', o: 'ellipse', b: 'brush', e: 'eraser', t: 'text', h: 'hand' };
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='t') { event.preventDefault(); setTool('transform'); return; }
    if (map[event.key.toLowerCase()]) setTool(map[event.key.toLowerCase()]);
    if (event.key === 'Enter' && state.activePath) { finishPath(); return; }
    if (event.key === '[' || event.key === ']') { state.brushSize = Math.max(1, Math.min(500, state.brushSize + (event.key === ']' ? 4 : -4))); $('brushSize').value = state.brushSize; $('brushValue').textContent = `${state.brushSize} px`; }
    if (event.key === 'Escape') { if (state.activePath) { state.activePath = null; state.pathDrag = null; render(); } $('menuPopover').classList.add('hidden'); document.querySelectorAll('.modal-backdrop').forEach(modal => modal.classList.add('hidden')); clearSelection(); selectionBox.classList.add('hidden'); render(); }
  });
  document.addEventListener('keyup', event => { if (event.code === 'Space') { state.space = false; area.style.cursor = state.tool === 'hand' ? 'grab' : 'default'; } });
  window.addEventListener('resize', () => { if (state.doc) fit(); });
}

bind(); setTool('move');
(async () => {
  try {
    const recovery = await loadRecoveryPoint();
    if (!recovery) return;
    const when = recovery.savedAt ? new Date(recovery.savedAt).toLocaleString('pt-BR') : 'data desconhecida';
    if (confirm(`Foi encontrado um ponto de recuperação de ${when}. Deseja restaurar o documento "${recovery.doc.name}"?`)) {
      state.doc = recovery.doc; state.history.reset(); clearSelection(); state.editMask = false; showDocument(); markSaved('Documento recuperado'); toast('Ponto de recuperação restaurado.');
    }
  } catch (error) { console.warn('Não foi possível recuperar o autosave:', error); }
})();
