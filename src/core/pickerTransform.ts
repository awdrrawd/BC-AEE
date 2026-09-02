/** Canvas affine matrix: x = a*u + c*v + e, y = b*u + d*v + f. */
export type PickerMatrix = [number, number, number, number, number, number];

let capture: {matrices: PickerMatrix[]; offsetX: number} | undefined;

export function withPickerMatrices<T>(matrices: PickerMatrix[] | undefined, draw: () => T, offsetX = 0): T {
  const previous = capture;
  capture = matrices ? {matrices, offsetX} : undefined;
  try {
    return draw();
  } finally {
    capture = previous;
  }
}

/** Capture the final shader matrix, including AEE's extra draw for mirror-copy.
 * Coordinates are normalized texture coordinates until the image size is known. */
export function recordPickerMatrix(gl: WebGL2RenderingContext, data: Float32List) {
  if (!capture || data.length !== 16) return;
  const w = gl.canvas.width / 2, h = gl.canvas.height / 2;
  capture.matrices.push([data[0] * w, -data[1] * h, data[4] * w, -data[5] * h,
    // GLDrawAppearanceBuild packs CanvasBlink at x=500, then copies it back
    // to character-local x=0. Undo that atlas offset AFTER all transforms.
    (data[12] + 1) * w - capture.offsetX, (1 - data[13]) * h]);
}

export function applyPickerMatrix(m: PickerMatrix, x: number, y: number) {
  return {x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5]};
}

export function invertPickerPoint(m: PickerMatrix, x: number, y: number) {
  const det = m[0] * m[3] - m[1] * m[2];
  if (!Number.isFinite(det) || Math.abs(det) < 1e-10) return null;
  const dx = x - m[4], dy = y - m[5];
  return {x: (m[3] * dx - m[2] * dy) / det, y: (m[0] * dy - m[1] * dx) / det};
}
