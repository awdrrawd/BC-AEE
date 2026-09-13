import {activeWardrobeSource} from '@/core/wardrobeStorage';
import {wardrobeIdentity, wardrobeMutation} from '@/core/wardrobeMutation';
import {backupWardrobeSource, downloadJson} from '@/core/wardrobeFile';
import {bumpWardrobeData} from '@/core/wardrobeStore';
import {listSpsKeys, readSpsText} from '@/core/sps';
import {archiveSpsWardrobe} from '@/core/spsMaintenance';
import {prepareWardrobeDrawings, scanWardrobeDrawings} from '@/core/wardrobeDrawingMigration';
import {uploadSpsBlob} from '@/components/mask-system/freeDraw/spsDrawing';
import {askConfirm} from '@/core/prompts';
import {showToast} from '@/util/toast';
import {t} from '@/i18n/i18n';

function checkedIdentity() {
  const current = wardrobeIdentity();
  return () => { if (!current()) throw new Error('sps_account_changed'); };
}
function failed(error: unknown) {
  console.warn('[AEE] Wardrobe maintenance failed', error);
  showToast(t('wardrobe-maintenance-failed'), {color: '#f87171'});
}
export async function exportSpsArchive() {
  try {
    const source = activeWardrobeSource();
    if (source.id !== 'sps') return;
    await wardrobeMutation(false, async () => {
      const check = checkedIdentity();
      const owner = Player.MemberNumber;
      if (typeof owner !== 'number') throw new Error('not_logged_in');
      const archive = await archiveSpsWardrobe({list: listSpsKeys, read: readSpsText, check}, owner);
      check();
      downloadJson(`aee-sps-archive-${owner}-${Date.now()}.json`, JSON.stringify(archive));
      showToast(t('wardrobe-archive-done', {n: archive.notReferencedByObservedIndex.length}));
      return true;
    }, source);
  } catch (error) { failed(error); }
}
export async function migrateEmbeddedWardrobeDrawings() {
  const source = activeWardrobeSource();
  const check = checkedIdentity();
  try {
    if (source.isReady?.() === false) return;
    const plan = scanWardrobeDrawings(source);
    if (!plan.length) { showToast(t('wardrobe-drawing-none')); return; }
    if (!await askConfirm(t('wardrobe-drawing-confirm', {n: plan.reduce((n, row) => n + row.count, 0)}))) return;
    check();
    if (activeWardrobeSource() !== source) return;
    await wardrobeMutation(false, async () => {
      for (const row of plan) {
        if (source.nameAt(row.index) !== row.name || JSON.stringify(source.outfitAt(row.index)) !== JSON.stringify(row.before)) {
          throw new Error('wardrobe_changed');
        }
      }
      // Standard wardrobe backup is importable through the existing import dialog.
      if (!backupWardrobeSource(source)) throw new Error('backup_empty');
      const prepared = await prepareWardrobeDrawings(plan, async (slot, embedded) => {
        check();
        const url = embedded.startsWith('data:') ? embedded
          : typeof LZString !== 'undefined' ? LZString.decompressFromBase64(embedded) : null;
        const match = url?.match(/^data:(image\/(?:png|webp));base64,([A-Za-z0-9+/=]+)$/);
        if (!match) throw new Error('invalid_embedded_drawing');
        const bytes = Uint8Array.from(atob(match[2]), value => value.charCodeAt(0));
        const ref = await uploadSpsBlob(slot, new Blob([bytes], {type: match[1]}));
        check();
        return ref;
      }, check);
      check();
      for (const row of plan) {
        if (source.nameAt(row.index) !== row.name || JSON.stringify(source.outfitAt(row.index)) !== JSON.stringify(row.before)) throw new Error('wardrobe_changed');
      }
      for (const row of prepared) source.writeSlot(row.index, row.outfit, row.name);
      try {
        if (!await source.persist(prepared.map(row => row.index))) throw new Error('save_failed');
        check();
      } catch (error) {
        check();
        for (const row of plan) source.writeSlot(row.index, row.before, row.name);
        throw error;
      } finally { bumpWardrobeData(); }
      showToast(t('wardrobe-drawing-done'));
      return true;
    }, source);
  } catch (error) { failed(error); }
}
