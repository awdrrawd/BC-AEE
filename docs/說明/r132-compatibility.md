# R132Beta3 相容性調整

此變更位於 `fix/R132`，以提供的 `Bondage-College-Mirror-bondageclub` R132Beta3 原始碼及 `bc-stubs@132.0.0-Beta.3` 為準。這是 R132 專用分支，未宣告向下相容 R131。

## 已修正

| 範圍 | R132 的差異 | AEE 調整 |
| --- | --- | --- |
| 自由繪圖保存／同步 | `ItemPropertiesCompress` 只傳送可由白名單或物品定義辨識的欄位 | DrawingBoard 改用 NOARCH extended config，登記 `CustomDraw`、`CustomDrawSPS`、`OffsetX`、`OffsetY`、`MaskPriority` 的 `BaselineProperty` |
| 自由繪圖初始化 | 壓縮會省略預設值，接收端需要還原 | 使用原生 NOARCH Init，保留舊的完整 Property 存檔及新的壓縮資料；空白 SPS 預設為 `null`，避免被誤認為有圖片 |
| 自由繪圖入口 | 註冊 NOARCH 會建立標準 callbacks | 自訂 Load／Draw／Click／Exit 改用 `ScriptHooks`，確保資產重新註冊後仍進入 AEE 編輯器 |
| 部件拾取／圖層管理器 | `AppearanceItemColor` 第三參數是 `AssetGroup` 物件 | 傳入實際槽位物件；不再寫入角色的對話用 `FocusGroup` |
| 複製與預覽開關 | `AppearanceMenuBuild`、`AppearancePreviewBuild` 要明確傳入選取槽位 | 使用 `CharacterAppearanceSelectedGroup`，讓選單與服裝預覽立即更新 |
| 自訂槽位操作 | `InventoryRemove` 支援槽位陣列，新增 `InventoryRemoveItems` 入口並回傳移除項目陣列 | 批次及直接項目移除皆沿用 AEE 能力檢查，保留一般 BC 項目的操作與回傳值 |
| 衣櫃製作資料 | 裝備上的 Craft 改為精簡資料 | 補充資料型別使用 `ItemBundle['Craft']`，不再要求完整 `CraftingItem` |

型別依賴固定到 Beta3，避免用 R131 宣告掩蓋參數變更。建置產物 `dist/assets/app.js` 隨分支更新。

## 已核對、不需套用 ECHO 修補的部分

- AEE 使用函式掛鉤，沒有依 `GLDrawCanvas.GL` 文字替換 WebGL 函式，因此不受 ECHO 那組文字補丁失配直接影響。ECHO 本身仍須另行適配。
- AEE 未依賴已停用的 `CharacterAppearanceAssets` 平面列表，不需遷移到 `CharacterAppearanceGroupedAssets`。
- R132Beta3 目前保留 `LayerOverrides`、`wceOverrideHide` 的壓縮相容處理，AEE 的傾斜／鏡射及隱藏資料不需全面重寫。標準變形欄位仍走原生序列化。
- 單手套已有 typed config，其側別與範圍由 `TypeRecord` 和選項資料重建。自訂部位名稱也未以 `$` 開頭。

## R132 衣櫃資料遷移評估（尚未實作）

2026-09-16 補充：此處的 R131 FIX 指衣櫃內「舊資料遷移（R131）」功能，不是一般 API 相容性修補。本次僅記錄評估，未修改遷移器或編輯器。前述已修正項目及自動測試**未涵蓋以下圖層鍵問題**，不能據此判定舊衣櫃資料已完整相容。

### 已確認：未命名圖層的變形資料鍵改變

比對本機 R131 與 R132Beta3 快照的 `Scripts/CommonDraw.js`，`getTransform` 中的圖層鍵由 `layer.Name ?? asset.Name` 改成 `layer.Name ?? ""`。因此，未命名圖層使用物品名稱保存的變形值，在 R132 繪圖時不會按舊鍵讀取。這是資料鍵變更，目前沒有證據需要全面更改座標倍率。

```js
// R131：未命名圖層使用物品名稱
LayerTranslationX: { "ExampleAsset": 20 }
// R132：未命名圖層使用空字串
LayerTranslationX: { "": 20 }
```

| 欄位 | 可能症狀 |
| --- | --- |
| `LayerTranslationX`、`LayerTranslationY` | 原本的圖層位移失效 |
| `LayerScaleX`、`LayerScaleY` | 原本的圖層縮放失效 |
| `LayerRotation` | 原本的圖層旋轉失效 |

初估為 **1 類已確認的資料遷移問題，涉及 5 個欄位**。影響條件是資產含未命名圖層，且保存了對應的舊鍵變形值；具名圖層與整件物品的 `TranslationX/Y`、`ScaleX/Y`、`Rotation` 不因這項鍵變更而一律需要遷移。尚未掃描使用者衣櫃，無法估計受影響套數或比例。以上結論限於目前檢視的本機快照，正式 R132 仍需重新核對。

### 待修正的三處邏輯

| 範圍 | 現況 | 建議處理 |
| --- | --- | --- |
| 衣櫃遷移偵測與轉換 | `src/core/wardrobeMigration.ts` 的 `migratableLayerCount` 主要檢查 `LayerOverrides`，會漏掉已轉成 R131 原生格式、僅剩舊鍵的資料 | 增加五種原生圖層變形 map 的舊鍵偵測與遷移 |
| 現有 R131 遷移器 | `originalLayerPositions` 仍以 `layer.Name ?? asset.Name` 決定輸出鍵，在 R132 執行仍可能產生不適用的資料 | 讓舊 `LayerOverrides` 直接轉成 R132 適用格式；保留既有位置與整件物品變形的換算語意 |
| 編輯器讀寫 | `src/core/bc.ts` 的 `setLayerOverride`、`getLayerOverride` 仍將未命名圖層映射到物品名稱 | 同步調整讀寫，避免修復存檔後又寫入舊格式 |

實作陷阱：R132Beta3 的 `Scripts/Layering.js` 中，`Layering.UpdateProperty` 仍使用 `if (layerName)` 區分單層與整件物品。直接將空字串傳給此函式，會寫入整件物品的屬性；AEE 自己的 fallback 也有相同判斷。因此不能只替換圖層鍵，必須明確區分「未命名圖層」與「全部圖層／整件物品」。原生 Layering 面板的單層輸入則直接寫入 `Layer*` map。

### 建議的 R132 FIX 行為與驗收

- 沿用衣櫃遷移的選取、前後預覽及備份流程，顯示受影響服裝、部件與欄位；已轉換資料再次執行應保持不變。
- 根據實際資產圖層判斷，不能將所有等於物品名稱的鍵盲目改成空字串；物品名稱可能同時是真實的具名圖層名稱。
- 新舊鍵同時存在、資產不存在或圖層對應有歧義時，標示衝突並保留原資料，不直接覆蓋或刪除。
- 驗證僅有舊原生 map、僅有舊 `LayerOverrides`、混合兩者、已有 R132 新鍵、具名圖層及整件物品變形等情境。
- 驗證未命名圖層在編輯、保存、重新載入及同步後仍一致，且不會誤改整件物品的變形。

### 待驗證風險，不列為已確認的遷移需求

| 項目 | 目前判斷／後續核對 |
| --- | --- |
| 資產圖層新增、刪除或重排 | `LayerOverrides` 以索引對應圖層，若資產定義變更可能錯位；尚未完成逐資產差異盤點，不能宣稱普遍發生 |
| 自由繪圖舊資料 | 前述 baseline 登記已處理壓縮識別；仍需實際衣櫃還原與跨玩家驗收。若資料先前已被丟棄，遷移器無法憑空重建，需要備份 |
| `LayerOverrides`／`wceOverrideHide` | Beta3 暫時保留相容處理，目前無全面重寫依據；正式版需再核對序列化規則 |

## 自動驗證

- `npm test`：包括新增的 `test-r132-appearance.mjs`、`test-r132-compatibility.mjs`，以及補強的槽位存取測試。
- `npm run lint`、`npm run build`、`npm run check:docs`。
- `scripts/fixtures/r132-item-runtime.js` 是所提供 R132Beta3 鏡像的原函式摘錄，檔首記錄來源，每個來源區段附 SHA256。測試直接在 VM 執行壓縮／解壓縮、bundle 轉換、NOARCH 初始化與 callback 建立邏輯；資產登記表與繪圖 UI 使用替身。
- 覆蓋內嵌圖片、SPS 引用、預設值省略、清空圖片、舊完整屬性存檔、外觀大小估算、跨兩個獨立 VM 的還原、資產重載、顏色入口及選取分類重建。

2026-09-16 驗證結果：27/27 回歸腳本、6/6 架構瀏覽器測試通過；型別、建置、文件連結、翻譯檢查通過。瀏覽器測試使用 `PLAYWRIGHT_CHANNEL=msedge`（本機沒有 Playwright 內附 Chromium）。Lint 為 0 errors，保留現有 41 個 React 警告；建置仍有 ModSDK CommonJS／ESM 與 chunk 大小警告，翻譯檢查仍有其他語言既有缺字提示。

## 遊戲內驗收

自動測試不等同完整遊戲畫面或實際伺服器同步測試。分支可用現有的本地 loader 測試：執行 `npm run dev`，載入 `loader.local.user.js`，重新開啟 R132Beta3。一般 `loader.user.js` 仍指向正式 GitHub Pages，不能用它判斷本機分支是否生效。

1. 在服裝分類切換人物預覽及懸停試穿，確認預覽立即更新，原生按鈕仍可操作。
2. 由角色部件拾取與圖層管理器進入調色；返回時確認分類與色彩正常。
3. 保存內嵌自由繪圖、調整位移與遮罩順位，換房、重登及從 AEE 衣櫃還原。
4. 對 SPS 自由繪圖重複以上操作，並驗證清空後不會重新出現舊圖。
5. 使用兩位載入此分支的 R132 玩家，檢查可見繪圖、遮罩及單手套的雙向操作與同步。
6. 分別測試 AEE 單獨載入及與已適配 R132 的 ECHO／LSCG 同時載入。

此分支不會自動修復其他插件的相容性問題，也不會將 R132 發布到 main。
