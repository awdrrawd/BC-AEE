# AEE 未完成事項

本文件只記錄尚未完成或尚未找到可靠解法的功能。已完成的架構與實作不保留試錯紀錄，改寫到對應的正式文件。

## 1. 面板收納動畫統一

### 目前狀態

- 圖層管理器具有可辨識的向右滑出與淡出效果。
- 側邊工具列、控制面板與設定頁雖已共用部分 CSS transition／keyframe，實機觀察仍與修改前相近，沒有達到一致的滑入、滑出與淡化效果。
- 部分面板在 `open` 變成 `false` 後會立即從 React tree 卸載。這類面板即使套用 exit class，也沒有機會播放離場動畫。
- 控制面板在整齊模式下長期保持掛載，只替換內頁內容；它和真正開啟／關閉的浮動面板不是同一種生命週期。

### 下次處理方法

不要再個別增加 CSS class。先建立統一的動畫元件或 hook，至少支援三種情境：

1. `docked`：由畫布邊緣滑入／滑出並淡化，例如側邊控制面板、圖層管理器。
2. `floating`：原位淡入／淡出，例如位移、旋轉、透明度、背景與姿勢面板。
3. `page`：同一容器內保留新舊頁面並進行切換，例如一般控制頁、圖層頁與設定頁。

共用處理必須負責 presence：關閉時保留舊內容直到 exit animation 結束，再卸載 DOM。不能只切換 className。建議擴充 `src/components/view-controls/useAnimatedPresence.ts`，或建立 `AnimatedPanelPresence` 與 `AnimatedPanelPage` 元件，統一 duration、easing、進出方向、opacity、`pointer-events`、快速反覆開關與 `prefers-reduced-motion`。

### 驗證清單

- 一般模式開啟／關閉設定頁。
- 編輯模式在一般控制、圖層、透明度與設定頁間切換。
- 整齊模式與自由模式的所有浮動工具。
- 視圖控制、背景子選單、背景設定、位移與姿勢面板。
- 調色盤展開／收納。
- 圖層管理器開啟／關閉。
- 快速連點開關時不閃跳、不留下透明但可點擊的 DOM。

## 2. 文字圖層變形

### 目前狀態

- AEE 不對具有 `Text`、`Text2`、`Text3` 的 `DynamicAfterDraw` 道具解除變形鎖定。
- 曾測試允許編輯原生 `TranslationX`／`TranslationY` 等數值，但 R131 的文字渲染沒有套用位移，因此已撤回 UI 與例外判斷。

### 後續條件

- R132 預計由官方接手文字圖層的變形渲染。
- R131 後續也可能提前修復，需以實際遊戲版本測試為準。
- 官方能正確渲染前，不應再次提供只有數值變化、畫面沒有變化的編輯入口。
- 官方支援後應直接使用原生 Layering properties，不另建 AEE 私有文字位移格式。

## 3. LSCG 圖層面板隱藏穩定性

### 目前狀態

- AEE 會檢查 LSCG Global／Opacity 模組及 AEE 替代工具是否存在。
- `MutationObserver` 會處理 LSCG 延遲建立或重新建立 `#lscg-layers` 的情況。

### 後續觀察

若仍出現短暫閃現，應考慮與 LSCG 協作，在 `OpacityModule.ShowDomUI()` 前加入可取消事件，從建立來源阻止面板，而不是在 DOM 建立後隱藏。

## 已完成項目索引

- 服裝／道具拾取、詳細標籤、懸停閃爍與外框：`docs/appearance-picking-and-hover.md`
