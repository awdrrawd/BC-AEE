#!/usr/bin/env node
// Detects drift in the Bondage Club functions that AEE hooks through ModSDK (same job as AFC's
// check-bc-compat.mjs, which only checks that a target exists; this one also notices when its body changes).
//
//   node scripts/check-bc-compat.mjs --bc-dir <BC source>            compare against the committed baseline
//   node scripts/check-bc-compat.mjs --bc-dir <BC source> --update   rewrite the baseline from that source
//
// The source can be a checkout of the code mirror (Scripts/ and Screens/ at the root) or of the upstream
// repository (everything under BondageClub/). For plain functions the hash is ModSDK's own algorithm (CRC32 of
// the function source, CRLF normalised), so it equals bcModSdk.getPatchingInfo().get(name).originalHash whenever
// the game serves the same source. `Namespace.method` targets (classes, object-literal namespaces) are hashed
// from their source text, and names BC only generates at runtime from a `<Name>Hook` function (extended items)
// are checked through that function; both are marked in the baseline and are for drift detection only.
// Exit codes: 0 = in sync, 1 = drift found, 2 = usage or parse problem.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parse} from 'acorn';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const DEFAULT_BASELINE = path.join(ROOT, 'scripts', 'bc-compat-baseline.json');
const HOOK_CALL = /\b(hookFunction|patchFunction|removePatches|callOriginal|getOriginalHash)\(\s*(['"`])([^'"`\n]+)\2/g;
const DYNAMIC_CALL = /\b(?:hookFunction|patchFunction|removePatches|callOriginal|getOriginalHash)\(\s*(?!['"`)])/g;
const SKIPPED_SOURCES = new Set(['src/modsdk.js', 'src/i18n/flags-engine.js']);

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

const posix = file => file.split(path.sep).join('/');

/** CRC32 exactly as ModSDK computes originalHash (uppercase, 8 hex digits). */
export function crc32(text) {
  let crc = -1;
  for (const byte of new TextEncoder().encode(text)) {
    let value = 255 & (crc ^ byte);
    for (let bit = 0; bit < 8; bit++) value = 1 & value ? -306674912 ^ value >>> 1 : value >>> 1;
    crc = crc >>> 8 ^ value;
  }
  return ((-1 ^ crc) >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

export const hashSource = source => crc32(source.replaceAll('\r\n', '\n'));

/** Every BC function name AEE hooks, patches or calls through ModSDK, with where it is used. */
export function collectHookedFunctions(srcDir, rootDir = path.dirname(srcDir)) {
  const names = new Map();
  const dynamic = [];
  for (const file of walk(srcDir)) {
    const relative = posix(path.relative(rootDir, file));
    if (!/\.(?:[cm]?[jt]sx?)$/.test(file) || relative.startsWith('src/declare/') || SKIPPED_SOURCES.has(relative)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const lineOf = index => text.slice(0, index).split('\n').length;
    for (const match of text.matchAll(HOOK_CALL)) {
      const entry = names.get(match[3]) ?? {locations: []};
      entry.locations.push(`${relative}:${lineOf(match.index)}`);
      names.set(match[3], entry);
    }
    for (const match of text.matchAll(DYNAMIC_CALL)) dynamic.push(`${relative}:${lineOf(match.index)}`);
  }
  return {names, dynamic};
}

/** Top-level function declarations (and `var x = function`) of the BC scripts, which are the hookable ones. */
export function loadBcFunctions(bcDir) {
  const base = fs.existsSync(path.join(bcDir, 'Scripts')) ? bcDir : path.join(bcDir, 'BondageClub');
  const files = [...walk(path.join(base, 'Scripts')), ...walk(path.join(base, 'Screens'))].filter(file => file.endsWith('.js')).sort();
  if (!files.length) throw new Error(`No Scripts/ or Screens/ JavaScript found under ${bcDir}`);
  const functions = new Map();
  const duplicates = [];
  const parseErrors = [];
  const register = (name, source, file, line) => {
    const known = functions.get(name);
    if (known) duplicates.push(`${name}: ${known.file} and ${file}`);
    functions.set(name, {hash: hashSource(source), file, line});
  };
  for (const file of files) {
    const relative = posix(path.relative(base, file));
    const text = fs.readFileSync(file, 'utf8');
    let ast;
    try {
      ast = parse(text, {ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true, locations: true});
    } catch (scriptError) {
      try {
        ast = parse(text, {ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true, locations: true});
      } catch {
        parseErrors.push(`${relative}: ${scriptError.message}`);
        continue;
      }
    }
    for (const node of ast.body) {
      if (node.type === 'ClassDeclaration' && node.id) {
        for (const member of node.body.body) {
          if (member.type === 'MethodDefinition' && member.kind === 'method' && !member.computed && member.key.type === 'Identifier') {
            register(`${node.id.name}.${member.key.name}`, text.slice(member.start, member.end), relative, member.loc.start.line);
          }
        }
      } else if (node.type === 'VariableDeclaration') {
        for (const declaration of node.declarations) {
          if (declaration.id.type !== 'Identifier' || declaration.init?.type !== 'ObjectExpression') continue;
          for (const property of declaration.init.properties) {
            if (property.type !== 'Property' || property.kind !== 'init' || property.computed || property.key.type !== 'Identifier') continue;
            if (property.method || /^(?:Function|ArrowFunction)Expression$/.test(property.value.type)) {
              register(`${declaration.id.name}.${property.key.name}`, text.slice(property.start, property.end), relative, property.loc.start.line);
            }
          }
        }
      }
      if (node.type === 'FunctionDeclaration' && node.id) {
        register(node.id.name, text.slice(node.start, node.end), relative, node.loc.start.line);
      } else if (node.type === 'VariableDeclaration' && node.kind === 'var') {
        for (const declaration of node.declarations) {
          const init = declaration.init;
          if (declaration.id.type === 'Identifier' && init && /^(?:Function|ArrowFunction)Expression$/.test(init.type)) {
            register(declaration.id.name, text.slice(init.start, init.end), relative, node.loc.start.line);
          }
        }
      }
    }
  }
  const versionSource = fs.existsSync(path.join(base, 'Scripts/Game.js')) ? fs.readFileSync(path.join(base, 'Scripts/Game.js'), 'utf8') : '';
  const gameVersion = /var\s+GameVersion\s*=\s*["']([^"']+)["']/.exec(versionSource)?.[1] ?? 'unknown';
  return {functions, gameVersion, duplicates, parseErrors, fileCount: files.length};
}

/** What the baseline should hold for the current hooked set and BC source. */
export function fingerprint(hooked, bc) {
  const functions = {};
  const missing = [];
  for (const name of [...hooked.names.keys()].sort()) {
    let found = bc.functions.get(name);
    let via;
    if (!found && !name.includes('.')) {
      // Extended items get their Load/Draw/Click generated at runtime from a `<Name>Hook` function.
      found = bc.functions.get(`${name}Hook`);
      via = found ? 'Hook' : undefined;
    }
    if (found) functions[name] = {hash: found.hash, file: found.file, ...(via ? {via} : {})};
    else missing.push(name);
  }
  return {functions, missing};
}

export function compare(baseline, current) {
  const known = baseline?.functions ?? {};
  const changed = [];
  const unchanged = [];
  const added = [];
  for (const [name, now] of Object.entries(current.functions)) {
    if (!known[name]) added.push(name);
    else if (known[name].hash !== now.hash) changed.push({name, file: now.file, was: known[name].hash, now: now.hash});
    else unchanged.push(name);
  }
  const hookedNow = new Set([...Object.keys(current.functions), ...current.missing]);
  const stale = Object.keys(known).filter(name => !hookedNow.has(name));
  const drift = changed.length + current.missing.length + added.length + stale.length > 0;
  return {changed, unchanged, added, stale, missing: current.missing, drift};
}

export function renderReport({result, baseline, bc, hooked, commit}) {
  const lines = [];
  const where = name => (hooked.names.get(name)?.locations ?? []).slice(0, 3).join(', ');
  lines.push(`BC source: ${bc.gameVersion}${commit ? ` (${commit.slice(0, 12)})` : ''}; baseline: ${baseline?.gameVersion ?? 'none'}${baseline?.commit ? ` (${baseline.commit.slice(0, 12)})` : ''}.`);
  lines.push(`Checked ${result.unchanged.length + result.changed.length + result.missing.length + result.added.length} hooked BC functions.`);
  if (result.changed.length) {
    lines.push('', `Changed in BC since the baseline (${result.changed.length}) - review these hooks:`);
    for (const item of result.changed) lines.push(`- ${item.name} (${item.file}) ${item.was} -> ${item.now}; used at ${where(item.name)}`);
  }
  if (result.missing.length) {
    lines.push('', `Hooked by AEE but no longer defined by BC (${result.missing.length}) - these hooks will fail to install:`);
    for (const name of result.missing) lines.push(`- ${name}; used at ${where(name)}`);
  }
  if (result.added.length) {
    lines.push('', `Hooked by AEE but not in the baseline yet (${result.added.length}):`);
    for (const name of result.added) lines.push(`- ${name}; used at ${where(name)}`);
  }
  if (result.stale.length) {
    lines.push('', `In the baseline but no longer hooked by AEE (${result.stale.length}):`);
    for (const name of result.stale) lines.push(`- ${name}`);
  }
  if (bc.duplicates.length) lines.push('', `Defined more than once in BC (the later load wins): ${bc.duplicates.join('; ')}`);
  if (bc.parseErrors.length) lines.push('', `Could not parse ${bc.parseErrors.length} BC file(s): ${bc.parseErrors.join('; ')}`);
  if (!result.drift) lines.push('', 'All hooked functions match the baseline.');
  return `${lines.join('\n')}\n`;
}

function parseArguments(argv) {
  const options = {update: false, json: false, bcDir: process.env.BC_DIR, baseline: DEFAULT_BASELINE, report: undefined};
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    if (flag === '--update') options.update = true;
    else if (flag === '--json') options.json = true;
    else if (flag === '--bc-dir') options.bcDir = argv[++index];
    else if (flag === '--baseline') options.baseline = path.resolve(argv[++index]);
    else if (flag === '--report') options.report = path.resolve(argv[++index]);
    else throw new Error(`Unknown argument ${flag}`);
  }
  if (!options.bcDir) {
    const local = path.join(ROOT, 'BondageClub');
    if (fs.existsSync(local)) options.bcDir = local;
  }
  if (!options.bcDir) throw new Error('Pass --bc-dir <path to the BC source> or set BC_DIR.');
  options.bcDir = path.resolve(options.bcDir);
  return options;
}

function gitCommit(directory) {
  try {
    return execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();
  } catch {
    return undefined;
  }
}

export function main(argv) {
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  const hooked = collectHookedFunctions(path.join(ROOT, 'src'), ROOT);
  const bc = loadBcFunctions(options.bcDir);
  const current = fingerprint(hooked, bc);
  const commit = gitCommit(options.bcDir);
  if (hooked.dynamic.length) console.warn(`Hook names built at runtime cannot be checked: ${hooked.dynamic.join(', ')}`);
  if (bc.parseErrors.length) console.warn(`Could not parse: ${bc.parseErrors.join('; ')}`);
  if (options.update) {
    const missing = current.missing.length ? ` (not defined by BC and left out: ${current.missing.join(', ')})` : '';
    const baseline = {gameVersion: bc.gameVersion, ...(commit ? {commit} : {}), functions: current.functions};
    fs.writeFileSync(options.baseline, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log(`Baseline written for ${bc.gameVersion}: ${Object.keys(current.functions).length} functions${missing}.`);
    return current.missing.length ? 1 : 0;
  }
  const baseline = fs.existsSync(options.baseline) ? JSON.parse(fs.readFileSync(options.baseline, 'utf8')) : undefined;
  if (!baseline) {
    console.error(`No baseline at ${options.baseline}; create one with --update.`);
    return 2;
  }
  const result = compare(baseline, current);
  const report = renderReport({result, baseline, bc, hooked, commit});
  if (options.report) fs.writeFileSync(options.report, report);
  console.log(options.json ? JSON.stringify({gameVersion: bc.gameVersion, ...result}, null, 2) : report);
  if (bc.parseErrors.length && result.missing.length) return 2;
  return result.drift ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
