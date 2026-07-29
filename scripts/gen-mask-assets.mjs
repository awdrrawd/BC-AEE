// Regenerates src/components/mask-system/assets.ts from the source PNGs in public/.
// The mask/preview images are base64-embedded (not URL-loaded) because the glove
// mask is uploaded as a WebGL texture from inside the BC page, which is
// cross-origin to where the AEE bundle is hosted (a plain URL would be blocked by
// CORS). Run after changing any of the source PNGs:  node scripts/gen-mask-assets.mjs
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const enc = (f) => 'data:image/png;base64,' + readFileSync(join(root, 'public', f)).toString('base64');

const sources = {
  // constant name → source PNG in public/
  SG_ITEM_DATAURL: 'AEE_AssetGroup_SingleGlove.png', // glove item-menu preview
  SG_MASK_DATAURL: 'AEE_SingleGlove.png',            // glove mask (1000x1000, R=0..500 / L=500..1000)
  NAKED_DATAURL: 'AEE_AssetGroup_FreeDrawing.png',   // free-draw item-menu preview
};

const header = `// Base64-embedded PNG data URLs for the mask system. Embedded (not URL-loaded)
// because the glove mask is uploaded as a WebGL texture from inside the BC page,
// which is cross-origin to where the AEE bundle is hosted — a plain URL would be
// blocked by CORS. Regenerate with scripts/gen-mask-assets.mjs after changing the
// source PNGs in public/.
//
// Sources:
//   SG_MASK_DATAURL  = public/AEE_SingleGlove.png          (glove mask, 1000x1000;
//                      right hand = x 0..500, left hand = x 500..1000, cropped at
//                      runtime to the 500x1000 body-sized mask in singleGlove.ts)
//   SG_ITEM_DATAURL  = public/AEE_AssetGroup_SingleGlove.png (glove item preview)
//   NAKED_DATAURL    = public/AEE_AssetGroup_FreeDrawing.png (free-draw item preview)

`;

const body = Object.entries(sources)
  .map(([name, file]) => `export const ${name} = ${JSON.stringify(enc(file))};`)
  .join('\n\n') + '\n';

writeFileSync(join(root, 'src/components/mask-system/assets.ts'), header + body);
console.log('assets.ts regenerated from', Object.values(sources).join(', '));
