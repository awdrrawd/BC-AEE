import {useEffect, useMemo} from 'react';
import {filterSlots, pageCount, PER_PAGE} from '@/controllers/outfitsController';
import {goToPage} from '@/controllers/wardrobeController';
import type {WardrobeState} from '@/core/wardrobeStore';
import {WardrobeStage} from '@/components/wardrobe/WardrobeStage';
import {WardrobeHeader} from '@/components/wardrobe/WardrobeHeader';
import {OutfitListPanel} from '@/components/wardrobe/OutfitListPanel';
import {Toolbar} from '@/components/wardrobe/Toolbar';
import {OutfitGrid} from '@/components/wardrobe/OutfitGrid';
import {Pager} from '@/components/wardrobe/Pager';
import {ManagePanel} from '@/components/wardrobe/ManagePanel';
import {PreviewPanel} from '@/components/wardrobe/PreviewPanel';
import {DialogHost} from '@/components/ui/DialogHost';
import {PromptDialog} from '@/components/ui/PromptDialog';
import {usePrompt} from '@/core/prompts';

export function WardrobeScreen({state}: { state: WardrobeState }) {
  const prompt = usePrompt();
  const slots = useMemo(
    () => filterSlots(state.search, state.activeFilter, state.sortMode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.search, state.activeFilter, state.sortMode, state.dataVersion],
  );

  const pages = pageCount(slots);
  useEffect(() => {
    if (state.offset >= pages * PER_PAGE) goToPage(0, pages);
  }, [pages, state.offset]);

  if (!state.active || !state.canvasRect) return null;

  return <WardrobeStage canvasRect={state.canvasRect}>
    <WardrobeHeader/>

    <div className="flex min-h-0 flex-1 gap-5 px-10 pt-3 pb-6">
      <OutfitListPanel state={state}/>

      <div className="flex min-w-0 min-h-0 flex-1 flex-col gap-2.5">
        <Toolbar state={state}/>
        <OutfitGrid state={state} slots={slots}/>
        <Pager state={state} slots={slots}/>
      </div>

      <ManagePanel state={state}/>
      <PreviewPanel state={state}/>
    </div>

    <DialogHost/>
    {prompt ? <PromptDialog prompt={prompt} scale="stage"/> : null}
  </WardrobeStage>;
}
