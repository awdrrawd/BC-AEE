import {useEffect, useMemo} from 'react';
import cn from '@/util/cn';
import {filterSlots, isOutfitListCollapsed, pageCount, perPage} from '@/controllers/outfitsController';
import {goToPage} from '@/controllers/wardrobeController';
import type {WardrobeState} from '@/core/wardrobeStore';
import {useViewport} from '@/core/orientation';
import {settings, useSetting} from '@/core/settings';
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
  const {portrait} = useViewport();
  const layout = useSetting(settings.wardrobePanelLayout);
  // Subscribe to both so the grid re-lays-out when either the feature or the collapse state flips.
  useSetting(settings.wardrobeCollapseEnabled);
  useSetting(settings.wardrobeListCollapsed);
  const listCollapsed = isOutfitListCollapsed();
  const slots = useMemo(
    () => filterSlots(state.search, state.activeFilter, state.sortMode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.search, state.activeFilter, state.sortMode, state.dataVersion],
  );

  const pages = pageCount(slots);
  useEffect(() => {
    if (state.offset >= pages * perPage()) goToPage(0, pages);
  }, [pages, state.offset, layout, portrait]);

  if (!state.active || !state.canvasRect) return null;

  const renderPanel = (id: string) => {
    switch (id) {
      case 'list':
        // Kept mounted and slid shut so collapsing/expanding animates instead of snapping.
        return <div
          key="list"
          className={cn(
            'aee-list-slide flex min-h-0 shrink-0 overflow-hidden',
            listCollapsed ? 'w-0 -mr-5 opacity-0' : 'w-80 opacity-100',
          )}
          aria-hidden={listCollapsed}
        >
          <OutfitListPanel state={state}/>
        </div>;
      case 'grid':
        return <div key="grid" className="flex min-w-0 min-h-0 flex-1 flex-col gap-2.5">
          <Toolbar state={state} layout={layout}/>
          {/* Re-keyed on collapse so the grid replays its stretch as it resizes to 6↔8 cards. */}
          <OutfitGrid key={`grid-${listCollapsed}`} state={state} slots={slots}/>
          <Pager state={state} slots={slots}/>
        </div>;
      case 'manage':
        return <ManagePanel key="manage" state={state}/>;
      case 'preview':
        return <PreviewPanel key="preview" state={state}/>;
      default:
        return null;
    }
  };

  // Portrait: fixed DC/B arrangement — character + manage share the top half, the outfit grid
  // (人物卡) fills the bottom half, and the outfit list (A) is hidden. The saved panel layout only
  // drives the landscape row.
  const body = portrait
    ? <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-2 pb-3">
        <div className="flex min-h-0 flex-1 gap-3">
          {renderPanel('preview')}
          {renderPanel('manage')}
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          {renderPanel('grid')}
        </div>
      </div>
    : <div className="flex min-h-0 flex-1 gap-5 px-10 pt-3 pb-6">
        {layout.map(renderPanel)}
      </div>;

  return <WardrobeStage canvasRect={state.canvasRect}>
    <WardrobeHeader/>
    {body}
    <DialogHost/>
    {prompt ? <PromptDialog prompt={prompt} scale="stage"/> : null}
  </WardrobeStage>;
}
