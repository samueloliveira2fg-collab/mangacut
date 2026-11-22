import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Pen tool is wired to toolbar, keyboard, Bézier handles and SVG export', async () => {
  const [html, main, menus] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/ui/menus.js', import.meta.url), 'utf8')
  ]);
  assert.match(html, /data-tool="path"/);
  assert.match(main, /p:\s*'path'/);
  assert.match(main, /updateAnchor\(state\.activePath/);
  assert.match(main, /event\.key === 'Enter'.*finishPath/);
  assert.match(main, /event\.key === 'Escape'.*state\.activePath/);
  assert.match(menus, /Exportar caminhos SVG/);
});
