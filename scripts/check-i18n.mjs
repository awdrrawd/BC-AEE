import {appendFileSync, readdirSync, readFileSync} from 'node:fs';

const root = new URL('../src/i18n/locales/', import.meta.url);
const read = locale => {
  const value = JSON.parse(readFileSync(new URL(`${locale}/translation.json`, root), 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${locale}: translation root must be an object`);
  return value;
};
function flatten(value, prefix = '', result = {}) {
  for (const [key, text] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof text === 'string') result[path] = text;
    else if (text && typeof text === 'object' && !Array.isArray(text)) flatten(text, path, result);
    else throw new Error(`Translation ${path} must be a string or object`);
  }
  return result;
}
const tokens = text => [...new Set([...text.matchAll(/{{-?\s*([^},]+)(?:,[^}]+)?\s*}}/g)]
  .map(match => match[1].trim()))].sort().join(',');
const reference = flatten(read('EN'));
const rows = [];
let issueCount = 0;
for (const entry of readdirSync(root, {withFileTypes: true}).filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  const locale = flatten(read(entry.name));
  const missing = Object.keys(reference).filter(key => !(key in locale));
  const extra = Object.keys(locale).filter(key => !(key in reference));
  const mismatched = Object.keys(reference).filter(key => key in locale && tokens(reference[key]) !== tokens(locale[key]));
  const empty = Object.keys(locale).filter(key => !locale[key].trim());
  issueCount += missing.length + extra.length + mismatched.length + empty.length;
  rows.push(`| ${entry.name} | ${missing.length} | ${extra.length} | ${mismatched.length} | ${empty.length} |`);
  for (const [label, keys] of [['missing', missing], ['extra', extra], ['interpolation mismatch', mismatched], ['empty', empty]]) {
    if (keys.length) console.warn(`${entry.name} ${label}: ${keys.join(', ')}`);
  }
}
const report = `## Translation report (EN reference)\n\n| Locale | Missing | Extra | Interpolation | Empty |\n| --- | ---: | ---: | ---: | ---: |\n${rows.join('\n')}\n\nTranslation differences are advisory; malformed JSON or invalid value types fail the check.\n`;
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
if (issueCount && process.env.GITHUB_ACTIONS) console.log(`::warning title=Translation differences::${issueCount} differences; see job summary and logs.`);
if (issueCount && process.argv.includes('--strict')) process.exitCode = 1;
