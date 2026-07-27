// Central manager for the mask-system toolbar SVG icons.
//
// The raw SVGs live in ./icons/*.svg and are imported as strings (Vite `?raw`).
// From those we derive two things:
//   - MASK_ICON_URL / ICON: `data:image/svg+xml` URLs, used as the `Image`
//     argument to BC's canvas `DrawButton(...)` inside the free-draw editor.
//   - <MaskIcon name=... />: a React component that inlines the SVG, for any
//     React-side UI that wants to show the same glyph.

import penSvg from './icons/pen.svg?raw';
import eraserSvg from './icons/eraser.svg?raw';
import undoSvg from './icons/undo.svg?raw';
import colorPaletteSvg from './icons/colorPalette.svg?raw';
import shapeOutlineSvg from './icons/shapeOutline.svg?raw';
import shapeSolidSvg from './icons/shapeSolid.svg?raw';
import bucketSvg from './icons/bucket.svg?raw';
import shapeEditSvg from './icons/shapeEdit.svg?raw';
import undoBoxSvg from './icons/undoBox.svg?raw';
import paletteSvg from './icons/palette.svg?raw';

// Raw SVG markup keyed by logical icon name.
export const MASK_ICON_SVG = {
  pen: penSvg,                 // 筆 — 畫筆
  eraser: eraserSvg,           // 橡皮擦工具-64 — 橡皮擦
  undo: undoSvg,               // icons8-返回-100 — 復原
  color: colorPaletteSvg,      // icons8-color-palette-100 — 顏色
  fillOutline: shapeOutlineSvg, // 圖形-框 — 填滿：線框
  fillSolid: shapeSolidSvg,    // 圖形-填滿 — 填滿：實心
  bucket: bucketSvg,           // 填色 — 油漆桶
  shape: shapeEditSvg,         // 編輯 — （備用，圖形鈕目前顯示當前形狀符號）
  undoBox: undoBoxSvg,         // 撤銷 — （備用）
  palette: paletteSvg,         // 調色盤 — （備用）
} as const;

export type MaskIconName = keyof typeof MASK_ICON_SVG;

// UTF-8-safe SVG → base64 data URL.
function svgToDataUrl(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `data:image/svg+xml;base64,${btoa(bin)}`;
}

export const MASK_ICON_URL = Object.fromEntries(
  Object.entries(MASK_ICON_SVG).map(([name, svg]) => [name, svgToDataUrl(svg)]),
) as Record<MaskIconName, string>;

// Alias used by the canvas toolbar (DrawButton Image arg).
export const ICON = MASK_ICON_URL;

export function MaskIcon({name, size = 24, className}: {name: MaskIconName; size?: number; className?: string}) {
  return (
    <span
      className={className}
      style={{display: 'inline-flex', width: size, height: size}}
      // The SVGs are our own bundled assets, not user input.
      dangerouslySetInnerHTML={{__html: MASK_ICON_SVG[name]}}
    />
  );
}
