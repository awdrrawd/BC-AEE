import {appendFileSync, readFileSync, readdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';

const directory = new URL('../dist/assets/', import.meta.url);
const files = readdirSync(directory).filter(file => /\.(?:js|css)$/.test(file)).sort();
if (!files.length) throw new Error('No build assets found; run npm run build first.');
let total = 0;
let compressed = 0;
const kib = bytes => (bytes / 1024).toFixed(2);
const rows = files.map(file => {
  const data = readFileSync(new URL(file, directory));
  const size = gzipSync(data).length;
  total += data.length;
  compressed += size;
  return `| ${file} | ${kib(data.length)} | ${kib(size)} |`;
});
const report = `## Build asset sizes\n\n| Asset | KiB | gzip KiB |\n| --- | ---: | ---: |\n${rows.join('\n')}\n| Total | ${kib(total)} | ${kib(compressed)} |\n\nInformational snapshot for this commit, not a performance measurement or merge threshold.\n`;
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
