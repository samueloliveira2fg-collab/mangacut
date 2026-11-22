export const $ = (id) => document.getElementById(id);
export const state = {
  doc: null, tool: 'move', zoom: 0.7, brushSize: 32, brushOpacity: 1,
  color: '#111111', drawing: false, moveStart: null, selectionStart: null,
  selectionMask: null, selectionRect: null, space: false, editMask: false,
  history: null, toastTimer: null, dirty: false, pointer: null
};

export function toast(message, duration = 2600) {
  const el = $('toast');
  if (!el) return;
  el.textContent = String(message);
  el.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

export function setDirty(value = true) {
  state.dirty = value;
  $('saveState').textContent = value ? 'Alterações não salvas' : 'Salvo';
}

export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
