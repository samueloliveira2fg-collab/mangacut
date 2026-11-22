import { createDocument, createLayer } from '../core/document.js';
import { downloadBlob } from './project.js';

export async function decodeImageFile(file) {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name}: formato não reconhecido como imagem.`);
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { file, img };
  } finally { URL.revokeObjectURL(url); }
}

export async function importImages(files) {
  const valid = [...files].filter(file => file.type.startsWith('image/'));
  if (!valid.length) throw new Error('Selecione arquivos de imagem.');
  const decoded = await Promise.all(valid.map(decodeImageFile));
  const first = decoded[0];
  const doc = createDocument(first.img.naturalWidth, first.img.naturalHeight, first.file.name, 'transparent');
  doc.layers = [];
  for (const { file, img } of decoded) {
    const layer = createLayer(doc, file.name);
    const scale = Math.min(doc.width / img.naturalWidth, doc.height / img.naturalHeight, 1);
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    layer.canvas.getContext('2d').drawImage(img, (doc.width - w) / 2, (doc.height - h) / 2, w, h);
    doc.layers.push(layer);
  }
  doc.activeId = doc.layers[doc.layers.length - 1].id;
  return doc;
}

export function exportPng(doc, previewCanvas) {
  previewCanvas.toBlob(blob => {
    if (!blob) throw new Error('Falha ao gerar PNG.');
    downloadBlob(blob, `${doc.name.replace(/\.[^.]+$/, '') || 'MangaCut'}.png`);
  }, 'image/png');
}
