import {settings} from '@/core/settings';
import {
  customFontFamily,
  DEFAULT_FONT_ID,
  findCustomFont,
  findSystemFont,
} from '@/core/fonts';
import {ensureCustomFontLoaded, isCustomFontReady, setFontErrorListener, setFontReadyListener} from '@/core/fontStore';
import {t} from '@/i18n/i18n';
import {showToast} from '@/util/toast';

// OnlineSharedSettings key that carries the wearer's chosen item font to other players.
const SHARED_FONT_KEY = 'AEEItemFont';

export function initItemFonts() {
  // When a font finishes downloading, redraw so items pick it up instead of the fallback.
  setFontReadyListener(refreshTextCharacters);
  setFontErrorListener((id, reason) => {
    const name = findCustomFont(id)?.name ?? id;
    showToast(t('settings-item-font-load-failed', {name, reason}), {color: '#f87171'});
  });
  // Toggling "show others' fonts" re-renders items so the change is visible immediately.
  settings.loadOthersFont.onChange(refreshTextCharacters);
  preloadOwnFont();
}

function preloadOwnFont() {
  const def = findCustomFont(currentOwnFontId());
  if (def) ensureCustomFontLoaded(def);
}

export function currentOwnFontId(): string {
  return settings.itemFont.get() || DEFAULT_FONT_ID;
}

/** Applies a font choice: persists it, shares it, loads it, and redraws items. */
export function selectItemFont(id: string) {
  settings.itemFont.set(id);

  // Broadcast the choice so others see our items in this font (unknown font ⇒ they get default).
  try {
    Player.OnlineSharedSettings ??= {} as Character['OnlineSharedSettings'];
    const shared = Player.OnlineSharedSettings as unknown as Record<string, unknown>;
    if (id === DEFAULT_FONT_ID) delete shared[SHARED_FONT_KEY];
    else shared[SHARED_FONT_KEY] = id;
    ServerAccountUpdate.QueueData({OnlineSharedSettings: Player.OnlineSharedSettings});
  } catch (error) {
    console.warn('🐈‍⬛ [AEE] Failed to share the item font choice', error);
  }

  const def = findCustomFont(id);
  if (def) ensureCustomFontLoaded(def);
  refreshTextCharacters();
}

/**
 * The CSS font-family to draw a character's text items in, or null to leave BC's default.
 * Self uses the live local setting (instant preview); others use their shared choice.
 */
export function itemFontFamilyFor(character: Character | null | undefined): string | null {
  const id = fontIdForCharacter(character);
  if (!id || id === DEFAULT_FONT_ID) return null;

  const system = findSystemFont(id);
  if (system) return system.family;

  const custom = findCustomFont(id);
  if (!custom) return null; // a font we don't have — fall back to default
  if (isCustomFontReady(id)) return customFontFamily(id);

  ensureCustomFontLoaded(custom); // kick off; refreshTextCharacters redraws once ready
  return null;
}

function fontIdForCharacter(character: Character | null | undefined): string {
  if (character && character === Player) return currentOwnFontId();
  // Others' fonts are only applied when the viewer opts in.
  if (!settings.loadOthersFont.get()) return DEFAULT_FONT_ID;
  const shared = character?.OnlineSharedSettings as unknown as Record<string, unknown> | undefined;
  const id = shared?.[SHARED_FONT_KEY];
  return typeof id === 'string' ? id : DEFAULT_FONT_ID;
}

/** Rebuilds character canvases so item text re-renders with the current fonts. */
function refreshTextCharacters() {
  const characters = typeof Character !== 'undefined' && Array.isArray(Character) && Character.length
    ? Character
    : [Player];
  for (const character of characters) {
    try {
      if (character) CharacterRefresh(character, false, false);
    } catch {
      // Skip characters that can't be refreshed (e.g. not fully loaded yet).
    }
  }
}
