import clipboardPasteSvg from 'lucide-static/icons/clipboard-paste.svg?raw';
import copySvg from 'lucide-static/icons/copy.svg?raw';
import trashSvg from 'lucide-static/icons/trash-2.svg?raw';

const STROKE = '#0a0d0e';

function toDataUri(svg: string, size: number): string {
  const sized = svg
    .replace(/width="\d+"/, `width="${size}"`)
    .replace(/height="\d+"/, `height="${size}"`)
    .replace('currentColor', STROKE);
  return `data:image/svg+xml,${encodeURIComponent(sized)}`;
}

export const COPY_ICON = toDataUri(copySvg, 60);
export const PASTE_ICON = toDataUri(clipboardPasteSvg, 60);
export const CLEAR_ICON = toDataUri(trashSvg, 86);