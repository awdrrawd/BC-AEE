import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';

const sourceRoot = path.resolve('src');
const lucideEntries = new Set([
  'components/icons/Icons.tsx',
  'components/main-panel/icons/Icons.tsx',
  'components/wardrobe/icons/Icons.tsx',
]);

async function sourceFiles(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  const nested = await Promise.all(entries.map(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : [file];
  }));
  return nested.flat().filter(file => /\.tsx?$/.test(file));
}

for (const file of await sourceFiles(sourceRoot)) {
  const source = await readFile(file, 'utf8');
  const relative = path.relative(sourceRoot, file).replaceAll('\\', '/');

  if (!lucideEntries.has(relative)) {
    assert.doesNotMatch(source, /from\s+['"]lucide-react['"]/, `${relative} must use one of the category Icons.tsx entry points`);
  }

  if (relative !== 'components/icons/iconSources.ts' && relative !== 'controllers/viewController.ts') {
    assert.doesNotMatch(source, /['"]Icons\/[A-Za-z][^'"]*['"]/, `${relative} must use GAME_ICONS`);
  }
}

console.log('Icon organization OK');
