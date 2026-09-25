import bcAeeModSdk from '@/modsdk';
import {DRAW_GROUPS, drawMaskGroupName} from './constants';

const maskPaths = DRAW_GROUPS.map(group => `/${drawMaskGroupName(group)}/`);
const isDrawingMask = (url: string) => maskPaths.some(path => url.includes(path));

interface MaskDraw {
  gl: WebGL2RenderingContext;
  atlasX: number;
  texture?: WebGLTexture;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  layers?: Array<{layer: TextureAlphaMask; image: HTMLImageElement}>;
}
let drawing: MaskDraw | undefined;
let installed = false;
let canvas: HTMLCanvasElement | undefined;

/** BC builds texture masks before the target's translation/rotation/scale.
 * Capture that texture, then project our character-space drawing through the
 * inverse FINAL shader matrix. This also includes LSCG/ECHO and AEE transforms,
 * without guessing their coordinate rules or changing their rendering. */
export function installTransformedMaskHooks() {
  if (installed || typeof GLDrawImage !== 'function' || typeof GLDrawLoadTextureAlphaMask !== 'function') return;
  bcAeeModSdk.hookFunction('GLDrawImage', -100, (args, next) => {
    const previous = drawing;
    drawing = args[4]?.TextureAlphaMask?.some(layer => isDrawingMask(layer.Url))
      ? {gl: args[1], atlasX: args[5] ?? 0} : undefined;
    try { return next(args); } finally { drawing = previous; }
  });
  bcAeeModSdk.hookFunction('GLDrawLoadTextureAlphaMask', -100, (args, next) => {
    const texture = next(args);
    if (drawing && drawing.gl === args[0] && args[1] > 1 && args[2] > 1 && args[5]?.some(layer => isDrawingMask(layer.Url))) {
      const layers = args[5].map(layer => ({layer, image: GLDrawImageCache.get(layer.Url)}));
      if (layers.every(({image}) => image?.complete && image.naturalWidth > 0)) {
        Object.assign(drawing, {texture, width: args[1], height: args[2], x: args[3], y: args[4], layers});
      }
    }
    return texture;
  });
  installed = true;
}

/** Called at the existing final-matrix interception, for normal and mirror-copy draws. */
export function alignDrawingMask(gl: WebGL2RenderingContext, matrix: Float32List) {
  const current = drawing;
  if (!current?.texture || current.gl !== gl || matrix.length !== 16) return;
  const {width, height, layers, texture} = current;
  const halfW = gl.canvas.width / 2, halfH = gl.canvas.height / 2;
  const a = matrix[0] * halfW / width, b = -matrix[1] * halfH / width;
  const c = matrix[4] * halfW / height, d = -matrix[5] * halfH / height;
  const e = (matrix[12] + 1) * halfW - current.atlasX;
  const f = (1 - matrix[13]) * halfH;
  const det = a * d - b * c;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-10) return;

  canvas ??= document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  for (const {layer, image} of layers) {
    ctx.globalCompositeOperation = layer.Mode || 'destination-in';
    if (isDrawingMask(layer.Url)) {
      ctx.setTransform(d / det, -b / det, -c / det, a / det,
        (c * f - d * e) / det, (b * e - a * f) / det);
      ctx.drawImage(image, layer.X, layer.Y, image.width, image.height);
    } else {
      // Native clothing masks retain BC's own image-local behaviour.
      ctx.resetTransform();
      ctx.drawImage(image, layer.X - current.x, layer.Y - current.y, image.width, image.height);
    }
  }
  // Keep the texture handle BC already returned and its cache ownership. Only
  // replace its pixels before this draw samples it; never change GL bindings.
  const binding = gl.getParameter(gl.TEXTURE_BINDING_2D);
  try {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  } finally {
    gl.bindTexture(gl.TEXTURE_2D, binding);
  }
}
