import {readFile, writeFile} from 'node:fs/promises';

const packageJsonPath = new URL('../package.json', import.meta.url);
const loaderPath = new URL('../loader.user.js', import.meta.url);
const readmePath = new URL('../README.md', import.meta.url);

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
const version = packageJson.version;

if (typeof version !== 'string' || !version) {
  throw new Error('package.json version must be a non-empty string');
}

async function replaceInFile(path, replacements) {
  const original = await readFile(path, 'utf8');
  let updated = original;

  for (const [pattern, replacement] of replacements) {
    if (!pattern.test(updated)) {
      throw new Error(`Pattern ${pattern} did not match ${path.pathname}`);
    }
    updated = updated.replace(pattern, replacement);
  }

  if (updated !== original) {
    await writeFile(path, updated);
  }
}

await replaceInFile(loaderPath, [
  [/^\/\/ @version .+$/m, `// @version ${version}`],
]);

await replaceInFile(readmePath, [
  [/version-.+?-purple\.svg/g, `version-${version}-purple.svg`],
]);
