// Per-login onboarding hint.
//
// The first time the player enters a chatroom in each game session, drop a
// LOCAL chat message (only this player sees it — ChatRoomSendLocal) pointing
// users at where the AEE panel lives: it appears when you open the colour/dye
// screen for any item or piece of clothing. Shown once PER LOGIN — the guard is
// a module-level flag, which resets whenever the game (and AEE) reloads.

import bcAeeModSdk from '@/modsdk';
import {currentLanguage} from '@/i18n/i18n';

// Localized hint, keyed by AEE's normalized language code. Falls back to EN.
// Kept inline (not in the i18n JSON) because this is a BC-facing chat string,
// like the mask-system's in-canvas messages.
const HINT: Record<string, string> = {
  EN: '🐈‍⬛ <b>Liko - AEE is ready.</b> To edit an appearance, open the <b>colour / dye</b> screen of any item or piece of clothing — the AEE panel appears there. Visit Settings for a better experience.',
  TW: '🐈‍⬛ <b>Liko - AEE 已就緒。</b>想編輯外觀時，對任一「物品」或「服裝」開啟<b>染色（調色）</b>畫面，就會看到 AEE 操作面板，並前往設定得到更好的體驗。',
  CN: '🐈‍⬛ <b>Liko - AEE 已就绪。</b>想编辑外观时，对任一「物品」或「服装」打开<b>染色（调色）</b>界面，就会看到 AEE 操作面板，并前往设置获得更好的体验。',
  JA: '🐈‍⬛ <b>Liko - AEE の準備ができました。</b>外見を編集するには、アイテムや衣装の<b>染色（カラー）</b>画面を開いてください。AEE パネルが表示されます。設定を開くとより快適に使えます。',
  KO: '🐈‍⬛ <b>Liko - AEE 준비 완료.</b>외형을 편집하려면 아이템이나 의상의 <b>염색(색상)</b> 화면을 여세요. AEE 패널이 나타납니다. 설정에서 더 나은 경험을 누려보세요.',
  VI: '🐈‍⬛ <b>Liko - AEE đã sẵn sàng.</b> Để chỉnh sửa ngoại hình, hãy mở màn hình <b>nhuộm màu</b> của bất kỳ vật phẩm hay trang phục nào — bảng AEE sẽ hiện ở đó. Vào Cài đặt để có trải nghiệm tốt hơn.',
  DE: '🐈‍⬛ <b>Liko - AEE ist bereit.</b> Um ein Aussehen zu bearbeiten, öffne den <b>Färben-/Farbbildschirm</b> eines beliebigen Gegenstands oder Kleidungsstücks — dort erscheint das AEE-Panel. Besuche die Einstellungen für ein besseres Erlebnis.',
  FR: '🐈‍⬛ <b>Liko - AEE est prêt.</b> Pour modifier une apparence, ouvre l\'écran de <b>teinture / couleur</b> de n\'importe quel objet ou vêtement — le panneau AEE y apparaît. Va dans les Paramètres pour une meilleure expérience.',
  ES: '🐈‍⬛ <b>Liko - AEE está listo.</b> Para editar una apariencia, abre la pantalla de <b>tinte / color</b> de cualquier objeto o prenda: ahí aparece el panel de AEE. Visita los Ajustes para una mejor experiencia.',
  RU: '🐈‍⬛ <b>Liko - AEE готов.</b> Чтобы редактировать внешний вид, откройте экран <b>окрашивания / цвета</b> любого предмета или одежды — там появится панель AEE. Загляните в настройки для лучшего опыта.',
  UA: '🐈‍⬛ <b>Liko - AEE готовий.</b> Щоб редагувати зовнішній вигляд, відкрийте екран <b>фарбування / кольору</b> будь-якого предмета чи одягу — там з\'явиться панель AEE. Завітайте до налаштувань для кращого досвіду.',
};

function hintMessage(): string {
  return HINT[currentLanguage()] ?? HINT.EN;
}

let hooked = false;
// Once-per-login guard (resets on reload). `scheduled` prevents double-scheduling
// while the delayed send is pending (ChatRoomSync can fire several times fast).
let sent = false;
let scheduled = false;

export function installOnboarding() {
  if (hooked) return;
  if (typeof ChatRoomSync !== 'function') return; // BC not ready (shouldn't happen post-load)
  hooked = true;

  // ChatRoomSync fires when we enter/receive a room. Run after next() so we're
  // fully in the room, then send once the in-room check passes.
  bcAeeModSdk.hookFunction('ChatRoomSync', 0, (args, next) => {
    const ret = next(args);
    try { maybeSendHint(); } catch (e) { console.error('[AEE] onboarding 例外：', e); }
    return ret;
  });

  // If AEE was (re)loaded while already inside a chatroom, ChatRoomSync won't
  // fire again — attempt once now so a first-timer still gets the hint.
  try { maybeSendHint(); } catch (e) { console.error('[AEE] onboarding 例外：', e); }
}

function maybeSendHint() {
  if (sent || scheduled) return;
  scheduled = true;
  // Small delay so the room is fully loaded and ServerPlayerIsInChatRoom() is true.
  setTimeout(() => {
    try {
      if (sent) return;
      if (typeof ServerPlayerIsInChatRoom !== 'function' || !ServerPlayerIsInChatRoom()) {
        scheduled = false; // not in a room yet → allow a later attempt
        return;
      }
      if (typeof ChatRoomSendLocal !== 'function') { scheduled = false; return; }
      ChatRoomSendLocal(hintMessage());
      sent = true;
    } catch (e) {
      console.error('[AEE] onboarding 傳送失敗：', e);
      scheduled = false;
    }
  }, 1500);
}
