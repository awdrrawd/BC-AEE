# R132 相容性調整

最初以提供的 `Bondage-College-Mirror-bondageclub` R132Beta3 原始碼及 `bc-stubs@132.0.0-Beta.3` 完成適配，2026-09-18 再核對正式 R132 快照。這是 R132 專用分支，未宣告向下相容 R131。

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

## 正式 R132 補正（2026-09-18）

核對本機鏡像的 `Scripts/Game.js`：`GameVersion = "R132"`；CHANGELOG 更新到 2026-09-16。上游 commits 網頁本次無法讀取，因此本次結論限於提供的正式版快照。

- 編輯器的未命名圖層統一讀寫空字串鍵 `""`，不再使用資產名稱。正式版 `Layering.UpdateProperty` 仍以 truthy 判斷單層；AEE 對空字串直接寫入原生 map，避免誤改整件物品。
- 衣櫃遷移新增 `LayerTranslationX/Y`、`LayerScaleX/Y`、`LayerRotation` 的 R131 舊鍵轉換；即使沒有 `LayerOverrides` 也能偵測。
- 更舊的 `LayerOverrides` 直接轉成 R132 原生鍵，保留原本位置換算、整件物品變形與 AEE 傾斜／鏡射。既有原生值優先，重複遷移不再改變結果。
- 僅當資產含未命名圖層、且沒有同名的具名圖層時才轉換。新舊鍵並存、數值無效、缺少資產或鍵有歧義時，整件保留並標示衝突，禁止選取遷移。
- 沿用選取、前後預覽及備份流程，列出受影響欄位；入口改標 R132。儲存前檢查衣櫃是否已變更，防止舊預覽覆蓋新資料。
- 62 個靜態 hook 名稱在正式版來源重新核對，皆存在。原生壓縮、bundle 轉換與 extended callback 摘錄已比對；解壓縮測試更新為正式版「有 TypeRecord 也執行完整 Init」。

### 使用方式與限制

在衣櫃設定開啟「舊資料遷移（R132）」，分別檢查線上、本地與 SPS 的預覽，建議選「先備份，再遷移」。程式更新本身不會自動改寫使用者衣櫃。

本次沒有逐一比對所有資產圖層的增刪或重排。索引式 `LayerOverrides` 若因資產改版錯位，仍須個別檢查；已遺失的繪圖資料也只能從備份還原。自由繪圖、其他插件及跨玩家同步仍需遊戲內驗收。

## 自動驗證

- `npm test`：包括新增的 `test-r132-appearance.mjs`、`test-r132-compatibility.mjs`，以及補強的槽位存取測試。
- `npm run lint`、`npm run build`、`npm run check:docs`。
- `scripts/fixtures/r132-item-runtime.js` 是所提供正式 R132 鏡像的原函式摘錄，檔首記錄來源，每個來源區段附 SHA256。測試直接在 VM 執行壓縮／解壓縮、bundle 轉換、NOARCH 初始化與 callback 建立邏輯；資產登記表與繪圖 UI 使用替身。
- 覆蓋內嵌圖片、SPS 引用、預設值省略、清空圖片、舊完整屬性存檔、外觀大小估算、跨兩個獨立 VM 的還原、資產重載、顏色入口及選取分類重建。

2026-09-16 驗證結果：27/27 回歸腳本、6/6 架構瀏覽器測試通過；型別、建置、文件連結、翻譯檢查通過。瀏覽器測試使用 `PLAYWRIGHT_CHANNEL=msedge`（本機沒有 Playwright 內附 Chromium）。Lint 為 0 errors，保留現有 41 個 React 警告；建置仍有 ModSDK CommonJS／ESM 與 chunk 大小警告，翻譯檢查仍有其他語言既有缺字提示。

2026-09-18 正式版補正驗證：28/28 回歸腳本、6/6 架構瀏覽器測試通過；型別、建置、文件連結及翻譯檢查通過。新增測試涵蓋五種未命名圖層讀寫（有／無原生 Layering API）、舊鍵／舊 override／混合格式、衝突與缺少資產、重複遷移、儲存失敗回復及過期預覽。Lint 仍為 0 errors、41 個既有警告；建置與其他語言缺字提示同前。發布產物 `dist/assets/app.js` 已重新建置。

## 遊戲內驗收

自動測試不等同完整遊戲畫面或實際伺服器同步測試。分支可用現有的本地 loader 測試：執行 `npm run dev`，載入 `loader.local.user.js`，重新開啟 R132。一般 `loader.user.js` 仍指向正式 GitHub Pages，不能用它判斷本機分支是否生效。

1. 在服裝分類切換人物預覽及懸停試穿，確認預覽立即更新，原生按鈕仍可操作。
2. 由角色部件拾取與圖層管理器進入調色；返回時確認分類與色彩正常。
3. 保存內嵌自由繪圖、調整位移與遮罩順位，換房、重登及從 AEE 衣櫃還原。
4. 對 SPS 自由繪圖重複以上操作，並驗證清空後不會重新出現舊圖。
5. 使用兩位載入此分支的 R132 玩家，檢查可見繪圖、遮罩及單手套的雙向操作與同步。
6. 分別測試 AEE 單獨載入及與已適配 R132 的 ECHO／LSCG 同時載入。

此分支不會自動修復其他插件的相容性問題，也不會將 R132 發布到 main。
