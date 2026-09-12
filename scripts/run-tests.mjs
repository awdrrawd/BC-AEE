import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const directory = new URL('./', import.meta.url);
const files = readdirSync(directory).filter(name => /^test-.*\.mjs$/.test(name)).sort();
if (!files.length) throw new Error('No regression scripts found');
const failures = [];
for (const file of files) {
  console.log(`\nRunning ${file}`);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(file, directory))], {
    stdio: 'inherit', timeout: 120_000,
  });
  if (result.error || result.status !== 0) {
    failures.push(file);
    if (result.error) console.error(result.error.message);
  }
}
console.log(`\n${files.length - failures.length}/${files.length} regression scripts passed.`);
if (failures.length) {
  console.error('Failed:', failures.join(', '));
  process.exitCode = 1;
}
