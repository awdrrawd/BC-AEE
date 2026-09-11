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
  return nested.flat();
}

const svgOwners = new Set([
  ...lucideEntries,
  'components/main-panel/EditorIcons.tsx',
  'components/main-panel/TransformIcons.tsx',
  'components/wardrobe/icons/LayoutIcon.tsx',
  'components/mask-system/icons.tsx',
  // Interactive geometry overlays are not reusable icons.
  'components/overlays/FreeTransformGizmo.tsx',
  'components/overlays/RotationOverlay.tsx',
]);
const cssMaskAsset = 'components/main-panel/icons/drag-slider.svg';

for (const file of await sourceFiles(sourceRoot)) {
  const relative = path.relative(sourceRoot, file).replaceAll('\\', '/');
  if (relative.endsWith('.svg')) {
    assert.equal(relative, cssMaskAsset, `${relative} needs an explicit SVG owner`);
    continue;
  }
  if (!/\.tsx?$/.test(file)) continue;
  const source = await readFile(file, 'utf8');
  if (!svgOwners.has(relative)) {
    assert.doesNotMatch(source, /<svg\b/, `${relative} must use its category's SVG components`);
  }
  if (relative !== 'controllers/copyPasteIcons.ts') {
    assert.doesNotMatch(source, /from\s+['"]lucide-static\//, `${relative} must use a Canvas icon source module`);
  }

  if (!lucideEntries.has(relative)) {
    assert.doesNotMatch(source, /from\s+['"]lucide-react['"]/, `${relative} must use one of the category Icons.tsx entry points`);
  }

  if (relative !== 'components/icons/iconSources.ts' && relative !== 'controllers/viewController.ts') {
    assert.doesNotMatch(source, /['"]Icons\/[A-Za-z][^'"]*['"]/, `${relative} must use GAME_ICONS`);
  }
}

const css = await readFile(path.join(sourceRoot, 'tailwind.css'), 'utf8');
assert.equal((css.match(/drag-slider\.svg/g) ?? []).length, 1, 'Slider SVG must have one CSS source');
assert.ok(css.includes(cssMaskAsset), 'Slider mask must use its category asset');
console.log('Icon organization OK');
