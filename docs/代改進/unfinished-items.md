# AEE 未完成事項

[文件索引](../README.md) · [互動架構圖](../architecture/index.html)

架構層級的改善另見[架構檢查與調整順序](./architecture-review.md)。

## 雲端衣櫃與繪圖可靠性（dev 功能訴求）

2026-09-12 依 main 與 dev 差異確認，仍需完成：載入／錯誤時禁止雲端修改、等待保存結果、來源與 metadata 隔離、帳號切換及登入失敗恢復、非同步繪圖 session、確認前僅本地預覽、保留舊衣櫃圖片引用。另需設計單槽衣櫃儲存的安全遷移與批次失敗復原。

這些是 AEE 的待修正行為，不因 dev 架構較舊而取消；完整目的、現況及驗收見 [dev 功能訴求與移植計畫](./dev-review.md)。目前只完成審查，尚未實作。

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

## 3. Blob URL 主動回收

- 已於 2026-09-12 核對：`spsDrawing.ts` 的 SPS 圖片快取沒有主動淘汰／回收；`imageImport.ts` 的短期解碼 URL 已有回收，此項只追蹤前者。
- 改進時需確認快取與畫面不再引用 URL，避免回收後圖片消失。
- 來源：[SPS 自由繪圖](../說明/sps-free-draw.md)。

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
