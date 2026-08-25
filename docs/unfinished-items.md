# AEE 未完成事項

本文件記錄目前已知但尚未找到可靠解法的功能，方便日後繼續調查。內容以目前程式狀態為準。

## 1. 道具的部件拾取

### 目前狀態

- 衣服（`Asset.Group.Category === "Appearance"`）保留部件拾取功能。
- 道具／拘束物品（`Asset.Group.Category === "Item"`）目前不顯示部件拾取按鈕，也不執行拾取。
- 停用入口位於：
  - `src/controllers/appearancePickerController.ts` 的 `layerPickerEnabled()`。
  - `src/components/ToolbarSide.tsx` 的 `EditingButtons()`。
- 底層 capture、命中測試和 `ItemColorClick` hook 暫時保留，方便之後繼續實驗。

### 已知症狀

- 道具進入編輯模式後，拾取按鈕曾能顯示，但第二階段「一般拾取」點擊角色沒有反應。
- 第三階段「詳細拾取」沒有產生任何圖層標籤。
- AEE 面板內的圖層懸停閃爍可以識別道具圖層，表示 `Item` 和圖層資料本身存在；問題較可能發生在角色畫布的繪圖 capture、座標映射或畫面生命週期。

### 已嘗試的方法

1. 將 `CharacterAppearanceMode === "Color"` 加入一般服裝拾取支援範圍。
   - 造成普通衣服拾取和部件拾取的狀態互相干擾，已撤回。
2. hook `ItemColorClick`，在道具染色畫面的點擊 dispatcher 入口執行 `handleAppearancePickerClick()`。
   - 點擊入口存在，但沒有可命中的 layer capture。
3. 透過圖片檔名把 `GLDrawImage` 的 URL 對應至 `Asset.Layer`。
   - 對模組道具或特殊圖層不可靠。
4. 使用 `CommonDrawResolveLayerColor` 記錄的 `currentDrawLayerItem` 和 `currentDrawLayerIndex`，直接將 `GLDrawImage` 歸屬到目前圖層。
   - 程式上能取得索引，但實際道具畫面仍沒有產生一般命中或詳細標籤。
5. 嘗試從 `ItemColorDraw` 的參數建立角色畫布座標。
   - 查閱 BC 程式後確認 `ItemColorDraw(c, group, x, y, width, height)` 的座標屬於右側調色 UI，不是角色預覽位置，因此不可用，已撤回。

### 相關程式入口

- `src/controllers/appearancePickerController.ts`
  - `captureAppearanceDraw()`
  - `captureAppearanceImage()`
  - `commitAppearancePickerFrame()`
  - `pickLayerAt()`
  - `drawDetailedLayerPicker()`
  - `handleLayerPickerClick()`
- `src/hooks/drawingHooks.ts`
  - `GLDrawImage` capture
- `src/hooks/renderHooks.ts`
  - `CommonDrawResolveLayerColor` 的 item/layer 追蹤
- `src/hooks/appearanceHooks.ts`
  - `AppearanceRun`、`DrawCharacter`、`GameClick`、`AppearanceClick` 和 `CommonClick`
- `src/hooks/itemColorHooks.ts`
  - `ItemColorDraw`、`ItemColorClick` 和 `ItemColorLoad`
- BC 參考：
  - `Screens/Character/Appearance/Appearance.js`
  - `Screens/Character/ItemColor/ItemColor.js`
  - `Scripts/CommonDraw.js`

### 建議的下一步

下次調查時，建議先加入只在開發模式啟用的診斷資料，不要直接再修改命中算法。每一幀至少記錄：

- `CurrentScreen`、`CharacterAppearanceMode`、`DialogMenuMode`。
- `state.visible`、`state.item`、`state.layerPickerMode`、`state.activeDrag`。
- `CharacterAppearanceSelection === runtime.currentRenderChar` 是否成立。
- `captureAppearanceDraw()` 是否取得 `drawAt`，以及其 `x/y/zoom/heightResize`。
- 每次 `GLDrawImage` 的 URL、X/Y、目前 item、Asset、layer index。
- `frame`、`layerFrame`、`captures`、`layerCaptures` 在 commit 前後的大小。
- `canvasMap()` 是否為 `null`。
- `pickLayerAt()` 中每個 layer 的 bounds、換算座標和 alpha 命中結果。

較值得驗證的方向：

1. `CharacterLoadCanvas()` 是否在 commit 前清空 capture，導致道具畫面永遠只留下空 frame。
2. 道具編輯時是否使用另一個 Character、canvas 或離屏 render target，造成 `runtime.currentRenderChar !== CharacterAppearanceSelection`。
3. 道具圖層是否透過 `DynamicAfterDraw`、`drawCanvas` 或 `DrawImageCanvas` 繪製，而不是目前主要監聽的 `GLDrawImage`。
4. `CommonDrawResolveLayerColor` 記錄的 layer 是否在真正繪圖前被其他 nested draw 覆寫。
5. close-up（縮放 4）和 full-body（縮放 0.95/1）兩次繪圖是否被混入同一個 frame，導致座標及 bounds 無效。
6. 可考慮在 `CommonDrawAppearanceBuild` 的 layer loop 建立一次性的 render token，再由 `GLDrawImage`／`DrawImageCanvas` 消費，而不是依賴全域的最後一個 layer index。

### 重新開放條件

只有在以下項目都能穩定通過後，才移除 `Category === "Item"` 的停用判斷：

- 一般拾取可點選道具的可見圖層。
- 詳細拾取會顯示標籤，標籤能選取正確圖層。
- 重疊圖層的排序與循環選取正確。
- 開啟畫布拖曳時暫停拾取，關閉拖曳後恢復。
- 關閉拾取模式後不殘留外框、標籤或點擊攔截。
- 衣服拾取功能沒有回歸問題。

## 2. 文字圖層變形

### 目前狀態

- AEE 不對具有 `Text`、`Text2`、`Text3` 的 `DynamicAfterDraw` 道具解除變形鎖定。
- 曾測試允許編輯原生 `TranslationX`／`TranslationY` 等數值，但 R131 實際文字渲染沒有套用位移，因此已完整撤回 UI 與例外判斷。

### 後續條件

- R132 預計由官方處理文字圖層的變形渲染。
- 若 R131 後續修復也可能提前支援，需以實際遊戲版本測試為準。
- 官方能正確渲染前，不應再次提供只有數值變化、畫面沒有變化的編輯入口。
- 官方支援後應優先直接使用原生 Layering properties，不另建 AEE 私有文字位移格式。

## 3. 已處理但建議持續觀察

### LSCG 圖層面板隱藏

- 已改為檢查 LSCG Global/Opacity 模組及 AEE 替代工具是否存在。
- 已加入 `MutationObserver`，LSCG 延遲建立或重新建立 `#lscg-layers` 時會重新套用隱藏。
- 若仍出現面板閃現，可考慮與 LSCG 協作，在 `OpacityModule.ShowDomUI()` 前加入可取消事件，從源頭阻止建立，而不是在 DOM 建立後隱藏。

