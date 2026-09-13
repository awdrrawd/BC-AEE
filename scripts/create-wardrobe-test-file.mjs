import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/** Clone a real, exported outfit so test data uses assets available in the user's game. */
export function createWardrobeTestFile(input, count, start = 0) {
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(start) || start < 0 || start + count > 984) {
    throw new Error('count/start must be integers within slots 0..983');
  }
  if (input?.format !== 'aee-wardrobe' || input.version !== 1 || !Array.isArray(input.slots)) throw new Error('Use a standard AEE wardrobe export');
  const sample = input.slots.find(slot => Array.isArray(slot?.outfit) && slot.outfit.length
    && slot.outfit.every(item => item && typeof item.Group === 'string' && typeof item.Name === 'string'));
  if (!sample) throw new Error('Export at least one valid test outfit first');
  return {format: 'aee-wardrobe', version: 1, savedAt: new Date().toISOString(), player: 'AEE-TEST',
    slots: Array.from({length: count}, (_, offset) => ({index: start + offset,
      name: `AEE-TEST-${String(start + offset + 1).padStart(3, '0')}`, favorite: offset % 2 === 0,
      tags: ['AEE-TEST'], outfit: structuredClone(sample.outfit)}))};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [input, output, count, start = '0'] = process.argv.slice(2);
    if (!input || !output || !count || process.argv.length > 6) throw new Error('Usage: node scripts/create-wardrobe-test-file.mjs INPUT.json OUTPUT.json COUNT [START_INDEX]');
    const result = createWardrobeTestFile(JSON.parse(fs.readFileSync(input, 'utf8')), Number(count), Number(start));
    fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
    console.log(`Created ${result.slots.length} test outfits in ${output}. Import only into a test wardrobe; existing files are never overwritten.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
