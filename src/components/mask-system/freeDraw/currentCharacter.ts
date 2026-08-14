// BC's CharacterGetCurrent is screen-state dependent rather than a safe
// nullable getter: while CurrentCharacter is uninitialized it can throw when
// reading FocusGroup. Free-draw code also runs from DrawCharacter/GL/image
// callbacks outside character screens, so all access goes through this helper.
export function safeCurrentCharacter(): Character | null {
  try {
    if (typeof CharacterGetCurrent === 'function') return CharacterGetCurrent() || null;
  } catch { /* CurrentCharacter is not initialized */ }
  return typeof Player !== 'undefined' ? Player : null;
}
