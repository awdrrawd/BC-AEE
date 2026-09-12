// Image import: put a picture from the user's own machine onto the board as a
// floating piece (drag to place, drag the corner grip to size), which bakes into
// the drawing's pixels on confirm. From then on it IS the drawing — no separate
// image object, nothing extra in the saved Property, and every other tool
// (eraser, bucket, 選取, 遮罩) treats it like any hand-drawn stroke.
//
// FILE ONLY — deliberately no "import from URL". Drawing a cross-origin <img>
// onto a canvas TAINTS that canvas, and taint spreads through drawImage rather
// than being laundered by it. A tainted board canvas would kill toDataURL (the
// drawing can no longer be SAVED at all), getImageData (undo, 油漆桶) and
// slotComposite (遮罩) for the rest of the session — and a taint only clears on
// a page reload. A File goes through a blob: URL on our own origin, which can
// never taint, so restricting the source is what actually buys the safety.
//
// The probe below is the belt to that braces: the picture is rasterised into a
// SCRATCH canvas and one pixel read back there. If a source ever does taint,
// only the scratch canvas dies and the user's drawing is untouched.

import {BOARD_W, BOARD_H} from '../constants';
import {t} from '@/i18n/i18n';
import {getActiveSession, isCurrentSession} from './slots';
import {placeFloating} from './selection';

// Keep the source at up to 2× the board — the resolution the drawing is finally
// rendered at — so scaling a piece up later still has real pixels behind it,
// without holding a 4000px photo in memory.
const MAX_BUF_W = BOARD_W * 2, MAX_BUF_H = BOARD_H * 2;
// Imported pictures land at 80% of the board whatever their source size, so a
// 16px icon and a 4000px photo are both immediately visible and grabbable.
const FIT = 0.8;

function pickImageFile(): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), {once: true});
    input.addEventListener('cancel', () => resolve(null), {once: true});
    input.click();
  });
}

function decode(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const done = (ok: boolean) => { URL.revokeObjectURL(url); if (ok) resolve(img); else reject(new Error('decode failed')); };
    img.addEventListener('load', () => done(true), {once: true});
    img.addEventListener('error', () => done(false), {once: true});
    img.src = url;
  });
}

// Shared by the toolbar button and Ctrl+V — a pasted picture arrives as a File
// too, so both routes are equally taint-proof and land in the same place.
async function placeFile(file: File) {
  const session = getActiveSession();
  if (!session || session.phase !== 'editing') return;

  let img: HTMLImageElement;
  try {
    img = await decode(file);
  } catch {
    DialogExtendedMessage = t('free-draw-image-failed');
    return;
  }
  const nw = img.naturalWidth, nh = img.naturalHeight;
  if (!nw || !nh) { DialogExtendedMessage = t('free-draw-image-failed'); return; }

  const bufScale = Math.min(1, MAX_BUF_W / nw, MAX_BUF_H / nh);
  const buf = document.createElement('canvas');
  buf.width = Math.max(1, Math.round(nw * bufScale));
  buf.height = Math.max(1, Math.round(nh * bufScale));
  const bctx = buf.getContext('2d')!;
  bctx.drawImage(img, 0, 0, buf.width, buf.height);
  try {
    bctx.getImageData(0, 0, 1, 1); // taint probe — throws here, before the board is touched
  } catch {
    DialogExtendedMessage = t('free-draw-image-tainted');
    return;
  }

  if (!isCurrentSession(session) || session.phase !== 'editing') return;
  const fit = Math.min(BOARD_W * FIT / nw, BOARD_H * FIT / nh);
  placeFloating(buf, Math.round(nw * fit), Math.round(nh * fit));
  DialogExtendedMessage = t('free-draw-image-placed');
}

export async function importImage() {
  const session = getActiveSession();
  if (!session || session.phase !== 'editing') return;
  const file = await pickImageFile();
  if (!file || !isCurrentSession(session) || session.phase !== 'editing') return;
  await placeFile(file);
}

// Ctrl+V. Listens for the real `paste` event rather than reading the clipboard
// API, so it needs no permission prompt and only ever sees what the user
// deliberately pasted. Attached only while the editor is open (input.ts).
export function onPaste(evt: ClipboardEvent) {
  const session = getActiveSession();
  if (!session || session.phase !== 'editing') return;
  const items = evt.clipboardData?.items;
  if (!items) return;
  for (let i = 0; i < items.length; i++) {
    if (items[i].kind !== 'file' || !items[i].type.startsWith('image/')) continue;
    const file = items[i].getAsFile();
    if (!file) continue;
    evt.preventDefault();
    void placeFile(file);
    return;
  }
}
