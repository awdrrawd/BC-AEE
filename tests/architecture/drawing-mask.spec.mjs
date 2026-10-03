import {test, expect} from '@playwright/test';
import fs from 'node:fs';
import ts from 'typescript';

const source = ts.transpileModule(fs.readFileSync('src/components/mask-system/transformedMasks.ts', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText;

test('drawing mask intersects final rendered pixels, including moved and rotated items', async ({page}) => {
  const result = await page.evaluate(async source => {
    const hooks = new Map();
    const exports = {};
    const require = name => name === '@/modsdk'
      ? {default: {hookFunction: (name, _, callback) => hooks.set(name, callback)}}
      : {DRAW_GROUPS: ['ItemCanvas1'], drawMaskGroupName: group => `${group}Mask`};
    window.GLDrawImage = () => {};
    window.GLDrawLoadTextureAlphaMask = () => {};
    window.GLDrawImageCache = new Map();
    eval(source);
    exports.installTransformedMaskHooks();
    const shape = document.createElement('canvas');
    shape.width = 500; shape.height = 1000;
    const shapeCtx = shape.getContext('2d');
    shapeCtx.fillRect(110, 310, 30, 30);
    const image = new Image();
    image.src = shape.toDataURL();
    await image.decode();
    const url = 'Assets/Female3DCG/ItemCanvas1Mask/ItemCanvas1MaskA.png';
    GLDrawImageCache.set(url, image);
    const layer = {Url: url, X: 0, Y: 0, Mode: 'destination-out'};
    const uploaded = document.createElement('canvas');
    const nativeTexture = {}, binding = {};
    let lastBinding = binding, uploads = 0;
    const gl = {
      canvas: {width: 2000, height: 1200},
      getParameter: () => lastBinding,
      bindTexture: (_, texture) => { lastBinding = texture; },
      texImage2D: (...args) => {
        const canvas = args.at(-1);
        uploaded.width = canvas.width; uploaded.height = canvas.height;
        uploaded.getContext('2d').drawImage(canvas, 0, 0); uploads++;
      },
    };
    // The oracle paints the transformed item first, then erases the drawing in
    // character space. Compare it with the actual corrected image-local mask.
    function draw(matrix, atlasX = 0, masks = [layer]) {
      const [a,b,c,d,e,f] = matrix;
      const shader = new Float32Array(16);
      shader[0] = a * 80 / 1000; shader[1] = -b * 80 / 600;
      shader[4] = c * 80 / 1000; shader[5] = -d * 80 / 600;
      shader[12] = (e + atlasX) / 1000 - 1; shader[13] = 1 - f / 600;
      let nativeBowAlpha;
      hooks.get('GLDrawImage')(['bow.png', gl, 100, 300, {TextureAlphaMask: masks}, atlasX], () => {
        hooks.get('GLDrawLoadTextureAlphaMask')([gl, 80, 80, 100, 300, masks], () => {
          // BC's original composition: shape sampled at the pre-transform
          // location. It cuts the bow even after the bow moves above the hole.
          uploaded.width = uploaded.height = 80;
          const ctx = uploaded.getContext('2d');
          ctx.fillRect(0, 0, 80, 80);
          ctx.globalCompositeOperation = 'destination-out';
          ctx.drawImage(image, -100, -300);
          nativeBowAlpha = ctx.getImageData(20,20,1,1).data[3];
          return nativeTexture;
        });
        exports.alignDrawingMask(gl, shader);
      });
      const actual = document.createElement('canvas'), expected = document.createElement('canvas');
      actual.width = expected.width = 500; actual.height = expected.height = 1000;
      const ac = actual.getContext('2d'), ex = expected.getContext('2d');
      ac.setTransform(...matrix); ac.drawImage(uploaded, 0, 0);
      ex.setTransform(...matrix); ex.fillRect(0,0,80,80);
      ex.resetTransform(); ex.globalCompositeOperation = 'destination-out'; ex.drawImage(image, 0,0);
      const actualPixels = ac.getImageData(0,0,500,1000).data;
      const expectedPixels = ex.getImageData(0,0,500,1000).data;
      let differences = 0;
      // Sample away from antialiased boundaries: exact inside/outside coverage.
      for (let y=205; y<395; y+=10) for (let x=55; x<245; x+=10) {
        const index = (y*500+x)*4+3;
        if (Math.abs(actualPixels[index]-expectedPixels[index]) > 8) differences++;
      }
      return {differences, nativeBowAlpha, bow: ac.getImageData(120,220,1,1).data[3], binding: lastBinding === binding};
    }
    const cases = [
      draw([1,0,0,1,100,200]), // previously cut at the old chest location
      draw([1,0,0,1,100,300]),
      draw([2,0,0,0.5,80,300]),
      draw([0,1,-1,0,180,280]),
      draw([-1,0,0,1,180,300]),
      draw([1,0,0.5,1,100,280]),
      draw([1,0,0,1,100,200], 1250), // ECHO's expanded blink atlas
    ];
    const before = uploads;
    hooks.get('GLDrawImage')(['ordinary.png', gl, 0,0,{},0], () => exports.alignDrawingMask(gl, new Float32Array(16)));
    return {cases, untouched: uploads === before};
  }, source);
  expect(result.cases.every(value => value.differences === 0)).toBe(true);
  expect(result.cases.every(value => value.binding)).toBe(true);
  expect(result.cases[0].bow).toBe(255);
  expect(result.cases[0].nativeBowAlpha).toBe(0);
  expect(result.untouched).toBe(true);
});
