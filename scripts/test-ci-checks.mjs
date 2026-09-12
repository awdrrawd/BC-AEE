import assert from 'node:assert/strict';
import {copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

// Run the real CLI against isolated fixtures so failures cannot damage repository files.
const temporaryRoot = path.resolve(tmpdir());
const fixture = mkdtempSync(path.join(temporaryRoot, 'aee-ci-checks-'));
function write(file, text) {
  const target = path.join(fixture, file);
  mkdirSync(path.dirname(target), {recursive: true});
  writeFileSync(target, text);
}
function run(script, args = []) {
  const env = {...process.env};
  delete env.GITHUB_STEP_SUMMARY;
  delete env.GITHUB_ACTIONS;
  const result = spawnSync(process.execPath, [path.join(fixture, 'scripts', script), ...args], {encoding: 'utf8', env});
  if (result.error) throw result.error;
  return result;
}
try {
  mkdirSync(path.join(fixture, 'scripts'));
  for (const file of ['check-docs.mjs', 'check-i18n.mjs']) copyFileSync(new URL(file, import.meta.url), path.join(fixture, 'scripts', file));
  write('README.md', '[Guide](docs/Guide.md)\n');
  write('docs/Guide.md', '# Guide\n');
  write('src/exists.ts', '');
  write('docs/architecture/index.html', "<script>const features=[\n{id:'demo',branches:[['Core','Demo',['src/exists.ts']]]}\n];</script>");
  assert.equal(run('check-docs.mjs').status, 0, 'valid documentation passes');
  write('README.md', '[Guide](docs/guide.md)\n');
  assert.equal(run('check-docs.mjs').status, 1, 'wrong path casing fails even on Windows');
  write('README.md', '[Guide][guide]\n\n[guide]: docs/missing.md\n');
  assert.equal(run('check-docs.mjs').status, 1, 'broken reference-style link fails');
  write('README.md', '[Guide](docs/Guide.md)\n');
  write('docs/architecture/index.html', "<script>const features=[\n{id:'demo',branches:[['Core','Demo',['src/missing.ts']]]}\n];</script>");
  assert.equal(run('check-docs.mjs').status, 1, 'deleted architecture source file fails');
  write('src/i18n/locales/EN/translation.json', JSON.stringify({greeting: 'Hello {{name}}'}));
  write('src/i18n/locales/TW/translation.json', JSON.stringify({greeting: '你好 {{name}}'}));
  assert.equal(run('check-i18n.mjs', ['--strict']).status, 0);
  write('src/i18n/locales/TW/translation.json', JSON.stringify({greeting: '你好 {{user}}'}));
  const advisory = run('check-i18n.mjs');
  assert.equal(advisory.status, 0, 'translation differences are advisory by default');
  assert.match(advisory.stderr, /interpolation mismatch/);
  assert.equal(run('check-i18n.mjs', ['--strict']).status, 1, 'strict mode rejects parameter mismatch');
  write('src/i18n/locales/TW/translation.json', '[]');
  assert.equal(run('check-i18n.mjs').status, 1, 'root arrays must not become advisory key differences');
  write('src/i18n/locales/TW/translation.json', '{invalid');
  assert.equal(run('check-i18n.mjs').status, 1, 'malformed JSON always fails');
  console.log('CI check fixtures passed: valid links, casing, missing files, interpolation and invalid JSON.');
} finally {
  assert.equal(path.dirname(path.resolve(fixture)), temporaryRoot);
  assert.ok(path.basename(fixture).startsWith('aee-ci-checks-'));
  rmSync(fixture, {recursive: true, force: true});
}
