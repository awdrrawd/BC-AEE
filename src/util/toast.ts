// Lightweight on-screen toast.
//
// Currently only used to replace ChatRoomSendLocal for import/export
// feedback, so the result is visible right away instead of only showing up
// after returning to the chat room.
//
// If another userscript on the page already exposes a shared toast system
// (window.Liko.__Sys_Toast__, e.g. a standalone toast-system.js), we call
// into that instead of drawing our own - no point stacking two visual
// systems on top of each other. Otherwise we fall back to this
// self-contained implementation.
//
// We deliberately never register ourselves as window.Liko.__Sys_Toast__:
// this is a slim, AEE-only fallback, not a shared system API, and claiming
// that slot could stop a real toast-system.js from ever installing itself
// (its own guard is "if the slot is already taken, skip loading").

export interface ToastOptions {
  duration?: number;
  color?: string;
  x?: number | null;
  y?: number | null;
  fontSize?: string | number;
}

type SharedToastFn = (message: string, options?: ToastOptions) => void;

const BASE_HEIGHT = 120;
const MSG_SPACING = 35;
// Matches the violet-400/500 accent used throughout AEE's own UI, instead of
// the hot-pink default some shared toast-system.js implementations use.
const AEE_TOAST_COLOR = '#8b5cf6';

let activeMessages: HTMLDivElement[] = [];

function repositionMessages() {
  activeMessages.forEach((msg, i) => {
    msg.style.bottom = `${BASE_HEIGHT + i * MSG_SPACING}px`;
  });
}

function localToast(message: string, options: ToastOptions = {}): void {
  try {
    const {duration = 3000, color = AEE_TOAST_COLOR, x = null, y = null, fontSize = '20px'} = options;
    const msgEl = document.createElement('div');
    msgEl.classList.add('aee-toast');
    msgEl.textContent = message;
    const translateX = x !== null ? '0' : '-50%';
    Object.assign(msgEl.style, {
      position: 'fixed',
      background: 'rgba(0,0,0,0.7)',
      color,
      padding: '8px 15px',
      borderRadius: '10px',
      fontSize: typeof fontSize === 'number' ? `${fontSize}px` : fontSize,
      fontWeight: 'bold',
      opacity: '0',
      transition: 'opacity 0.5s, transform 0.5s',
      zIndex: '9999',
      left: x !== null ? `${x}px` : '50%',
      bottom: y !== null ? `${y}px` : `${BASE_HEIGHT + activeMessages.length * MSG_SPACING}px`,
      transform: `translateX(${translateX}) translateY(0px)`,
      pointerEvents: 'none',
      userSelect: 'none',
    });
    document.body.appendChild(msgEl);
    activeMessages.push(msgEl);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        msgEl.style.opacity = '1';
        msgEl.style.transform = `translateX(${translateX}) translateY(-20px)`;
      });
    });
    setTimeout(() => {
      msgEl.style.opacity = '0';
      msgEl.style.transform = `translateX(${translateX}) translateY(-40px)`;
      setTimeout(() => {
        msgEl.parentNode?.removeChild(msgEl);
        activeMessages = activeMessages.filter(m => m !== msgEl);
        if (y === null) repositionMessages();
      }, 500);
    }, duration);
  } catch (error) {
    console.error('🐈\u200d⬛ [AEE] ❌ Toast failed:', error);
  }
}

// Re-checked on every call (not cached once) so AEE picks up a shared
// toast-system.js whether it loaded before or after AEE did.
function resolveSharedToast(): SharedToastFn | null {
  const shared = window.Liko?.__Sys_Toast__;
  return typeof shared === 'function' ? shared as SharedToastFn : null;
}

export function showToast(message: string, options?: ToastOptions): void {
  const merged: ToastOptions = {color: AEE_TOAST_COLOR, ...options};
  const shared = resolveSharedToast();
  if (shared) {
    shared(message, merged);
    return;
  }
  localToast(message, merged);
}
