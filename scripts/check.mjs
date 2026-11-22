import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['src'];
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (full.endsWith('.js')) files.push(full);
  }
}
for (const root of roots) await walk(root);
let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) { failed = true; console.error(`FAIL ${file}\n${result.stderr}`); }
  else console.log(`OK   ${file}`);
}
const html = await readFile('index.html', 'utf8');
if (!html.includes('type="module" src="src/main.js"')) { failed = true; console.error('Missing module entry point'); }
console.log(`Checked ${files.length} JavaScript modules.`);
if (failed) process.exit(1);
