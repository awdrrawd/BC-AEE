# AEE 未完成事項

[文件索引](../README.md) · [互動架構圖](../architecture/index.html)

架構層級的改善另見[架構檢查與調整順序](./architecture-review.md)。

## 雲端衣櫃與繪圖可靠性（dev 功能訴求）

本輪已實作單槽索引、100→984 容量、等待保存、SPS metadata 隔離、帳號範圍認證、繪圖 session 與內容 hash 圖片；正式行為見 [SPS 衣櫃](../說明/sps-wardrobe.md) 與 [SPS 自由繪圖](../說明/sps-free-draw.md)。

仍需完成遊戲內驗收、伺服器條件提交或等效的跨裝置衝突機制、舊記錄的安全清理，以及確認 SPS 分頁契約。請測試不同 AEE 版本共存、網路中斷及其他模組在繪圖預覽期間保存角色的情境。需求來源見 [dev 功能訴求與移植計畫](./dev-review.md)。

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

## 2. 舊 CustomDraw 批次遷移

- 尚未自動批次遷移未重新確認的舊繪圖；目前玩家逐槽重新確認時遷移。
- 來源：[SPS 自由繪圖](../說明/sps-free-draw.md)。

## 3. 圖片與雲端記錄資源管理

- SPS 繪圖來源改用最多 96 筆的 Data URL LRU，避免撤銷仍被 BC 引用的 Blob URL；本地匯入仍正常撤銷短期 URL。
- 尚需實機量測 BC／遮罩等其他快取的總記憶體。雲端舊圖片與衣櫃記錄保留，待設計可回復的清理流程。
- 來源：[SPS 自由繪圖](../說明/sps-free-draw.md)、[SPS 衣櫃](../說明/sps-wardrobe.md)。

## 4. 全域 AccountUpdate 容量保護

- 自由繪圖現有預警不能涵蓋其他模組或道具造成的完整 payload 超限。
- 待在共用人物保存／AccountUpdate 層檢查實際傳輸資料，並回報來源與大小；文件記錄約 180K，實作前應重新核對遊戲限制。
- 來源：[SPS 自由繪圖](../說明/sps-free-draw.md)。

## 持續追蹤與驗證狀態

本清單於 2026-09-02 依 DOCS 彙整，未重新以程式與實機逐項驗證。上游文字變形與 LSCG 面板穩定性移至[相容性追蹤](../持續追蹤/upstream-compatibility.md)；頭髮／五官白名單退場與遊戲內驗收另見[白名單追蹤](../持續追蹤/transform-whitelist.md)。

## 已完成實作說明索引

- 服裝／道具拾取、詳細標籤、懸停閃爍與外框：[外觀拾取與懸停](../說明/appearance-picking-and-hover.md)

## ESLint 10／React Hooks 7 規則遷移

使用 `reactHooks.configs.flat['recommended-latest']`，避免誤用 legacy plugins 陣列設定。新版啟用的 `use-memo`、`refs`、`immutability`、`set-state-in-effect` 暫設為 warning；Hooks 呼叫順序與依賴檢查保持既有設定。此次檢查有 41 則 Compiler 規則警告，尚未解決，需逐項調整並驗證拖曳、面板切換、衣櫃與外部資料同步後，才恢復為 error。不可用批次移動到 effect 或延遲 setState 的方式僅消除警告。
