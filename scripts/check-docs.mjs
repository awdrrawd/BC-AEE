import {existsSync, readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const docs = path.join(root, 'docs');
function walk(directory) {
  return readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
// Check casing even on Windows: Pages and the Linux runner are case-sensitive.
function existsExactly(file) {
  const relative = path.relative(root, file);
  if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) return false;
  let current = root;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    if (!existsSync(current) || !readdirSync(current).includes(part)) return false;
    current = path.join(current, part);
  }
  return existsSync(current);
}
let checked = 0;
const errors = [];
function check(file, href) {
  if (/^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(href)) return;
  try {
    const target = decodeURIComponent(href.split(/[?#]/)[0]);
    if (!target) return;
    checked++;
    if (!existsExactly(path.resolve(path.dirname(file), target))) errors.push(`${path.relative(root, file)} → ${href}`);
  } catch (error) {
    errors.push(`${path.relative(root, file)} → ${href}: ${error.message}`);
  }
}
for (const file of [path.join(root, 'README.md'), ...walk(docs).filter(file => /\.(?:md|html)$/.test(file))]) {
  let text = readFileSync(file, 'utf8');
  if (file.endsWith('.md')) {
    text = text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '').replace(/`[^`\n]+`/g, '');
    // Inline links/images and reference-style definitions. Remote links are deliberately offline.
    for (const match of text.matchAll(/\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\s*\)/g)) check(file, match[1] || match[2]);
    for (const match of text.matchAll(/^\s*\[[^\]]+\]:\s*<?([^\s>]+)>?/gm)) check(file, match[1]);
  }
  for (const match of text.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
    if (!match[1].includes('${')) check(file, match[1]);
  }
}
const architectureFile = path.join(docs, 'architecture/index.html');
const source = readFileSync(architectureFile, 'utf8');
const definition = source.match(/const features=(\[[\s\S]*?\n\]);/);
if (!definition) throw new Error('Architecture features array not found; update the checker when changing its format.');
const features = vm.runInNewContext(`(${definition[1]})`, {}, {timeout: 1000});
if (!Array.isArray(features) || !features.length) throw new Error('Architecture has no features');
const ids = new Set();
for (const feature of features) {
  if (!feature.id || ids.has(feature.id)) errors.push(`Missing/duplicate feature ID: ${feature.id}`);
  ids.add(feature.id);
  for (const [, , files] of feature.branches) {
    for (const file of files) {
      if (file.startsWith('src/')) check(architectureFile, `../../${file}`);
    }
  }
}
console.log(`Checked ${checked} local file/directory references and ${ids.size} architecture features.`);
if (errors.length) {
  console.error(`Broken or incorrectly cased references:\n${errors.join('\n')}`);
  process.exitCode = 1;
}
