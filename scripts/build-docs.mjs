import {mkdirSync, readFileSync, writeFileSync, copyFileSync} from 'node:fs';

const root = new URL('../', import.meta.url);
const output = new URL('dist/docs/architecture/', root);
const repository = 'https://github.com/awdrrawd/BC-AEE/blob/main/';
mkdirSync(output, {recursive: true});
// Keep the source HTML usable offline. Only the published copy links to repository files.
const source = readFileSync(new URL('docs/architecture/index.html', root), 'utf8');
const html = source
  .replaceAll('href="../README.md"', `href="${repository}docs/README.md"`)
  .replaceAll('href="../../${file}"', `href="${repository}\${file}"`);
writeFileSync(new URL('index.html', output), html);
copyFileSync(new URL('docs/aee-architecture.html', root), new URL('dist/docs/aee-architecture.html', root));
console.log('Published architecture HTML and legacy redirect to dist/docs/.');
