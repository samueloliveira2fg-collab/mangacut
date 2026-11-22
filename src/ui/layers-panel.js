import { $, state, toast, setDirty } from '../core/state.js';
import { childrenOf, activeNode } from '../core/document.js';

export function renderLayersPanel({ render, updateProperties, checkpoint, commit, select }) {
  const list = $('layerList');
  list.replaceChildren();
  if (!state.doc?.layers.length) { list.innerHTML = '<div class="layers-empty">As camadas aparecerão aqui.</div>'; return; }
  const makeRow = (layer, depth = 0) => {
    const row = document.createElement('div');
    row.className = `layer-row${layer.id === state.doc.activeId ? ' active' : ''}${layer.type === 'group' ? ' group-row' : ''}`;
    row.dataset.id = layer.id;
    row.style.paddingLeft = `${8 + depth * 16}px`;
    const eye = document.createElement('button'); eye.className = 'layer-eye'; eye.textContent = layer.visible ? '◉' : '○'; eye.title = 'Alternar visibilidade';
    eye.onclick = e => { e.stopPropagation(); checkpoint('Visibilidade'); layer.visible = !layer.visible; render(); renderLayersPanel({ render, updateProperties, checkpoint, commit, select }); commit('Visibilidade'); };
    const thumb = document.createElement('div'); thumb.className = 'layer-thumb';
    if (layer.type === 'raster') {
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 48;
      cv.getContext('2d').drawImage(layer.canvas, 0, 0, 64, 48);
      if (layer.mask) { const badge = document.createElement('small'); badge.className = 'mask-badge'; badge.textContent = 'M'; thumb.append(badge); }
      thumb.prepend(cv);
    } else if (layer.type === 'adjustment') { thumb.textContent = layer.kind === 'invert' ? '◐' : layer.kind === 'grayscale' ? '◑' : '◒'; thumb.classList.add('group-thumb', 'adjustment-thumb'); }
    else if (layer.type === 'text') { thumb.textContent = 'T'; thumb.classList.add('group-thumb', 'adjustment-thumb'); }
    else { thumb.textContent = layer.expanded === false ? '▸' : '▰'; thumb.classList.add('group-thumb'); }
    const name = document.createElement('div'); name.className = 'layer-name'; name.textContent = layer.name; name.title = 'Duplo clique para renomear';
    name.ondblclick = e => { e.stopPropagation(); const value = prompt('Nome da camada/grupo:', layer.name); if (value?.trim()) { checkpoint('Renomear'); layer.name = value.trim(); renderLayersPanel({ render, updateProperties, checkpoint, commit, select }); commit('Renomear'); } };
    row.append(eye, thumb, name);
    row.onclick = () => select?.(layer.id);
    list.append(row);
    if (layer.type === 'group' && layer.expanded) {
      for (const child of [...childrenOf(layer.id)].reverse()) makeRow(child, depth + 1);
    }
  };
  for (const root of [...childrenOf(null)].reverse()) makeRow(root);
}

export function updateLayerProperties() {
  const layer = activeNode();
  $('layerName').value = layer?.name || '';
  $('layerOpacity').value = Math.round((layer?.opacity ?? 1) * 100);
  $('opacityValue').textContent = `${$('layerOpacity').value}%`;
  $('blendMode').value = layer?.blend || 'source-over';
  $('editMask').checked = state.editMask;
  $('editMask').disabled = !layer?.mask;
  $('layerInfo').textContent = layer?.type === 'group' ? 'Grupo de camadas' : layer?.type === 'adjustment' ? `Camada de ajuste · ${layer.kind}` : layer ? (layer.mask ? 'Camada raster · Máscara vinculada' : 'Camada raster · Sem máscara') : 'Nenhuma camada selecionada';
  for (const [id, key, fallback] of [['layerX','x',0],['layerY','y',0],['layerScaleX','scaleX',1],['layerScaleY','scaleY',1],['layerRotation','rotation',0]]) { const input = $(id); if (input) { input.value = layer?.[key] ?? fallback; input.disabled = !layer || layer.type === 'group' || layer.type === 'adjustment'; } }
  const textButton = $('editTextLayer'); if (textButton) textButton.disabled = layer?.type !== 'text';
  for (const id of ['textFontFamily','textFontSize','textColor','textWeight']) if ($(id)) $(id).disabled = layer?.type !== 'text';
  if (layer?.type === 'text') { $('textFontFamily').value = layer.fontFamily || 'Arial'; $('textFontSize').value = layer.fontSize || 48; $('textColor').value = layer.color || '#111111'; $('textWeight').value = layer.fontWeight || 'normal'; }
  for (const id of ['layerFlipH','layerFlipV']) if ($(id)) $(id).disabled = !layer || layer.type === 'group' || layer.type === 'adjustment';
  const controls = $('adjustmentControls');
  if (controls) controls.classList.toggle('hidden', layer?.type !== 'adjustment');
  if (layer?.type === 'adjustment') { $('adjBrightness').value = layer.params?.brightness ?? 0; $('adjContrast').value = layer.params?.contrast ?? 0; $('adjSaturation').value = layer.params?.saturation ?? 0; $('adjBrightnessValue').textContent = `${$('adjBrightness').value}`; $('adjContrastValue').textContent = `${$('adjContrast').value}`; $('adjSaturationValue').textContent = `${$('adjSaturation').value}`; }
}

export function selectLayer(id, render, updateProperties) {
  state.doc.activeId = id;
  state.editMask = false;
  render(); updateProperties();
  document.querySelectorAll('.layer-row').forEach(row => row.classList.toggle('active', row.dataset.id === id));
}
