import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const retiredIdentity = ['clau', 'dian'].join('');
const ignoredDirectoryNames = new Set(['.git', 'node_modules']);
const textExtensions = new Set([
  '.css',
  '.js',
  '.json',
  '.jsonl',
  '.md',
  '.mjs',
  '.ts',
  '.yml',
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

test('package and Obsidian identities are Dean', () => {
  const packageJson = readJson('package.json');
  const packageLock = readJson('package-lock.json');
  const manifest = readJson('manifest.json');
  const bunLock = fs.readFileSync(path.join(root, 'bun.lock'), 'utf8');

  assert.equal(packageJson.name, 'dean');
  assert.match(packageJson.description, /^Dean\b/);
  assert.equal(packageLock.name, 'dean');
  assert.equal(packageLock.packages[''].name, 'dean');
  assert.match(bunLock, /"name": "dean"/);
  assert.equal(manifest.id, 'dean');
  assert.equal(manifest.name, 'Dean');
});

function listProductTextFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectoryNames.has(entry.name)) return [];

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listProductTextFiles(entryPath);
    if (!entry.isFile()) return [];

    return textExtensions.has(path.extname(entry.name)) || entry.name === 'bun.lock'
      ? [entryPath]
      : [];
  });
}

test('repository has no retired product identity', () => {
  const matches = listProductTextFiles(root).filter((file) => {
    const relativePath = path.relative(root, file).toLowerCase();
    const source = fs.readFileSync(file, 'utf8').toLowerCase();
    return relativePath.includes(retiredIdentity) || source.includes(retiredIdentity);
  });

  assert.deepEqual(matches.map(file => path.relative(root, file)), []);
});
