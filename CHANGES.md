# 變更說明

將本包內檔案覆蓋到專案同路徑，並刪除下列檔案：

- src/components/main-panel/EditTab.tsx
- src/components/main-panel/NumberInput.tsx
- src/components/main-panel/ToggleBar.tsx
- src/components/view-controls/DirectionButton.tsx

## 本輪修改內容

### 移除未使用的程式碼
- 刪除上述 4 個不再使用的元件檔案。
- `src/core/types.ts`：移除未使用型別 `UnknownFunction`、`EditControl`、`HookCallback`、`AnchoredRect`。
- 清理僅供內部使用、已無外部引用的 `export`（涉及 controllers、core/bc.ts、i18n/i18n.ts、mask-system、main-panel/styles.ts 等檔案）。
  - 注意：若有外部 plugin / 動態 import 依賴其中的 API，請保留對應 export。
- `src/core/settings.ts`：移除已無任何使用處的設定 key：`enableAeeMenu`、`enablePartsFilter`、`enableLayerManager`、`enableHideRestraints`、`showCharCtrl`、`fullbodyOffsetX`（`SettingKey` 型別同步精簡）。舊使用者 localStorage 內殘留的這些 key 會被忽略，不影響執行。
- `docs/architecture/index.html`：移除對 EditTab.tsx 的引用。

### 功能修正
- `bcWheelScroll`：設定關閉時不再攔截滾輪事件。
- `bcWheelScroll`：僅在確定可翻頁（`CharacterAppearanceSelection` 存在）時才 `preventDefault()` / `stopPropagation()`，否則放行給 View Controller 縮放。

### 介面文字與翻譯
- SettingsTab 為多項設定補上 tooltip（新增對應 `*-tooltip` 語系 key）。
- `menuHooks.ts`：Hover 試穿與角色預覽按鈕的提示文字改為隨開/關狀態切換（`hover-tryon-button-on/off`、`character-preview-button-on/off`）。
- 12 個語系翻譯皆已補齊（key 數量一致，皆為 588），並同步移除 `main-panel-tab-edit`；簡中由 OpenCC 轉換，其餘語系為人工撰寫，建議母語者校閱。
