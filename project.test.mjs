import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeProject } from '../src/io/project.js';

test('MCUT v3 preserves adjustment layers and saved alpha channels', () => {
  const fakeCanvas = { toDataURL: () => 'data:image/png;base64,AAAA' };
  const doc = {
    id: 'doc', name: 'Teste', width: 2, height: 2, colorMode: 'RGB', bitDepth: 8,
    activeId: 'adjustment', createdAt: '2026-01-01T00:00:00.000Z',
    layers: [{ id: 'adjustment', type: 'adjustment', name: 'Brilho', kind: 'brightnessContrast', params: { brightness: 12, contrast: -8, saturation: 20 }, visible: true, opacity: 0.75, blend: 'source-over', parentId: null }],
    channels: [{ id: 'alpha-1', name: 'Sujeito', type: 'alpha', canvas: fakeCanvas }]
  };
  const payload = serializeProject(doc);
  assert.equal(payload.version, 4);
  assert.equal(payload.layers[0].type, 'adjustment');
  assert.deepEqual(payload.layers[0].params, { brightness: 12, contrast: -8, saturation: 20 });
  assert.equal(payload.channels[0].name, 'Sujeito');
  assert.equal(payload.channels[0].canvas, 'data:image/png;base64,AAAA');
});

test('MCUT v3 preserva texto editável e transformação por camada', () => {
  const doc = {
    id: 'doc', name: 'Texto', width: 8, height: 8, colorMode: 'RGB', bitDepth: 8,
    activeId: 'text-1', createdAt: '2026-01-01T00:00:00.000Z', channels: [],
    layers: [{ id: 'text-1', type: 'text', name: 'Título', text: 'MangaCut', x: 12, y: 24, fontFamily: 'Arial', fontSize: 36, color: '#123456', scaleX: -1, scaleY: 1.5, rotation: 15, opacity: 0.8 }]
  };
  const payload = serializeProject(doc);
  assert.equal(payload.layers[0].type, 'text');
  assert.equal(payload.layers[0].text, 'MangaCut');
  assert.equal(payload.layers[0].fontSize, 36);
  assert.equal(payload.layers[0].scaleX, -1);
  assert.equal(payload.layers[0].scaleY, 1.5);
  assert.equal(payload.layers[0].rotation, 15);
});


test('MCUT v4 preserves document metadata, guides, grid and color profile', () => {
  const doc = { name: 'Meta', width: 2, height: 2, colorMode: 'RGB', bitDepth: 8, activeId: 'g',
    metadata: { source: 'scan', tags: ['manga', 'ink'] }, guides: [{ axis: 'x', position: 120 }],
    grid: { enabled: true, size: 16 }, colorProfile: 'sRGB IEC61966-2.1',
    layers: [{ id: 'g', type: 'group', name: 'Grupo', parentId: null }], channels: [] };
  const payload = serializeProject(doc);
  assert.deepEqual(payload.metadata, doc.metadata);
  assert.deepEqual(payload.guides, doc.guides);
  assert.deepEqual(payload.grid, doc.grid);
  assert.equal(payload.colorProfile, doc.colorProfile);
});
