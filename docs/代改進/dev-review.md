# dev 分支審查與移植順序

[文件索引](../README.md) · [互動架構圖](../architecture/index.html) · [架構指南](../說明/architecture.md)

檢查日期：2026-09-12。以下審查描述移植前的基準；本輪已開始實作，最新行為見 [SPS 衣櫃保存與容量](../說明/sps-wardrobe.md) 與 [SPS 自由繪圖](../說明/sps-free-draw.md)。本次是程式與 Git 差異審查，未執行 dev 的 OAuth 登入、雲端寫入或資料遷移，也未完成遊戲內驗收。以下「值得移植」不代表 dev 原實作可直接合併。

## 比較基準與分支處理

- main：`b1e78a607a806d43653a29d097fd81026c18e5ab`。
- dev：`801179f432b9c6c9349716d6169878ed91d9861e`。
- dev 落後 main 54 筆，獨有 1 筆提交：`feat: integrate studio OAuth for wardrobe management and enhance loading states`，相對共同祖先改動 40 個檔案（1594 行新增、551 行刪除）。提交標題未涵蓋全部變更，還包括繪圖狀態機與兩種雲端格式遷移。
- `origin/fix/eslint-upgrad` 落後 main 7 筆、沒有獨有提交，已可刪除；本次未刪除遠端分支。
- 已從上述 main 建立 `codex/dev-review`，本分支先完成審查文件，再依使用者授權進行功能修改。dev 保留作為來源參考；未整筆 cherry-pick 或合併。

審查同時使用共同祖先到 dev 的變更，以及 main 與 dev 的最終檔案差異。後者顯示 dev 缺少新的 CI、文件整理、圖示重構與多項功能修正，因此不能用 dev 整份目錄覆蓋 main。Git 三方合併並不必然刪除 main 的新增檔案，但仍不能替代對行為及格式相容性的檢查。

## dev 的功能訴求與 AEE 尚未完成的修正

以下目的依獨有提交與實際程式差異推導，不是作者另行提供的需求文件。dev 的重點是讓雲端衣櫃與繪圖在非同步操作下可靠保存、正確復原，並讓舊衣櫃中的圖片長期可用；不能把「分支太舊」當成這些需求已不存在。

| 使用者應獲得的結果 | main 現況／尚缺部分 | 要交付的修正與驗收 |
| --- | --- | --- |
| 雲端衣櫃開啟後能分辨正在載入、失敗與真的空白 | 沒有完整的 ready/error 操作門檻 | 載入與失敗時禁止修改雲端槽位；可重試；失敗不能把空白鏡像保存回雲端。 |
| 按下保存、刪除、交換、匯入後，畫面反映真正結果 | SPS persist 立即回傳成功；local IndexedDB persist 也屬背景寫入 | 依儲存來源定義完成語意；SPS／IndexedDB 等待寫入結果，失敗保留編輯與可重試資料。遊戲伺服器排程寫入不可假稱已收到持久化確認。 |
| 收藏、標籤與服裝保持一致，切來源不串資料 | SPS metadata 使用 local key；雲端 chunk 沒有 metadata | 先隔離來源，再完成 metadata 的雲端保存與遷移；保存／交換失敗時整組一致回復。 |
| 修改一槽不必反覆上傳整組衣櫃 | main 每次修改上傳整個 300 槽 chunk | 單槽儲存是 dev 想降低寫入量的方式，但須先解決格式遷移、交換／批次操作中途失敗與多裝置衝突。可先交付可靠保存，再交付效能改善。 |
| 讀取、上傳、文字輸入途中換角色或重開編輯器，不會寫錯目標 | 多處仍以 A 或 A !== slot 判定有效性 | session 綁定角色、物品、帳號與操作快照；所有非同步入口均需驗證，包括圖庫、圖片匯入與文字輸入。 |
| 未按確認的遮罩／優先度只是預覽，取消後恢復 | main 的遮罩切換與優先度確認會即時保存／廣播，取消時再補償 | 定義預覽、確認、取消、原生退出的共同生命週期；未確認操作不能被背景同步意外保存。這是行為修正，不只是增加 session 型別。 |
| 新畫不會破壞舊衣櫃保存的畫 | main 固定 SPS slot key 可被覆寫，舊 hash 因內容不符而無法還原 | 內容定址保存新畫、兼容讀取舊引用，驗證畫 A 存衣櫃後改畫 B，重新穿 A 仍正確。已被覆寫且無備份的舊圖片不能憑格式升級恢復。 |
| 網路或登入失敗能恢復，切帳號不沿用舊身分 | main OAuth 的 identityPromise 為全域、tokenCache 只依 resource；沒有帳號維度或明確失敗重置 | 認證生命週期與帳號綁定，失敗可重試、401 有界更新、逾時可取消。保留 adapter 邊界不等於認定現有 adapter 無須修正；是否採官方完整 client 應依契約驗證決定。 |
| 大圖與長時間使用仍可靠 | 估算錯誤可回傳 0，SPS Blob URL 快取無界 | 估算失敗明確阻擋不安全保存；有使用者引用的 URL 不提前 revoke，且未使用的資源能回收。 |

這張表記錄最初確認的訴求。現已實作單槽記錄／索引、100→984 容量、等待保存、SPS metadata 隔離、帳號範圍認證、繪圖 session、容量估算失敗保護及內容 hash 圖片；實機验收、跨裝置條件提交與雲端清理仍未完成。

## 值得重新實作的部分

| 順序 | 項目與來源 | 價值 | 移植方式與完成條件 |
| --- | --- | --- | --- |
| 1 | SPS 載入狀態、等待儲存結果；`core/wardrobeStorage.ts`、`controllers/outfitsController.ts`、衣櫃 UI | main 的 `persistSps` 啟動上傳後立即回傳 true；編輯表單可能先關閉，失敗才補通知。dev 改成等待並回復快照的方向正確。 | 先保留 main 的 chunk 格式；將儲存結果傳回 controller，加入 pending 與防重複提交、來源／帳號識別。失敗不關閉表單；回復須有版本檢查，不能覆蓋後續操作。 |
| 2 | 明確繪圖工作階段；`freeDraw/slots.ts`、`lifecycle.ts`、`imageImport.ts`、`FreeDrawLibraryPanel.tsx` | 僅比較全域槽位 A，無法區分「關閉後重開同一槽位」；舊圖片解碼或上傳結果可能套進新編輯。dev 的 session 身分與 loading/editing/saving 階段有價值。 | 在 main 現有模組分工下獨立加入 session；每次 await 後檢查 session、角色與仍穿戴的同一物品。測試慢速載入、切槽、同槽重開、編輯其他角色及儲存期間退出。 |
| 3 | 容量估算失敗不能當作 0；`freeDraw/appearanceSize.ts` | main 捕捉序列化錯誤後回傳 0，可能讓失敗估算看似安全。dev 改為回報錯誤，由 caller 阻擋儲存。 | 獨立小修正，明確顯示「無法估算」，不要以虛構容量冒充實測值；驗證正常容量、超限、序列化失敗及空白畫布。 |
| 4 | SPS timeout、錯誤代碼、401 處理、分頁；`core/sps.ts` | 可減少長時間無回應，讓 UI 分辨登入與網路失敗。 | 保留 main 的 `core/studioOauth.ts` adapter；實作前確認服務實際分頁契約。timeout 要涵蓋回應內容讀取，處理已取消 signal；並行 401 共用一次更新，不反覆開登入。 |
| 5 | SPS 中繼資料隔離；`wardrobeStorage.ts` 的 get/setSlotMeta | main 的 SPS 與 local 目前共用 local metadata key，可能混用同槽位收藏與標籤。 | 先定義來源隔離及舊資料歸屬，再處理跨裝置同步；不能直接假設 local 的標籤一定屬於 SPS。 |
| 6 | 繪圖以內容 hash 儲存；`freeDraw/spsDrawing.ts` 的 v4 | main 的固定槽位 key 被新畫覆蓋後，舊衣櫃中保存的 hash 可能再也讀不到原畫。dev 的內容 key 能保留舊引用。 | 獨立格式升級，繼續讀舊版本，明確規劃舊客戶端相容性、配額、未引用圖片清理及使用者備份；不順便更換 OAuth 或衣櫃格式。 |

## 阻擋 dev 原樣合併的問題

### 高：交易中途失敗仍回報成功，復原紀錄可被覆蓋

dev `core/wardrobeStorage.ts` 的 `writeSpsRecords` 在多筆操作前寫入固定的 `liko-aee:wardrobe/transaction`；任何 slot 寫入失敗時，catch 只記錄警告並 return。`persistSps` 因此回傳 true，下一筆多槽操作又能覆寫同一個 journal。第一筆尚未落盤的內容可能失去復原依據；journal 清除失敗後再進行單槽更新，也有日後重播舊值的風險。

單一分頁內的 Promise queue 不等於跨分頁／跨裝置的交易。需有明確的 pending/committed/failed 語意、未完成交易處理與版本衝突策略；尚未保證恢復前不能繼續覆寫 journal 或回報完成。

### 高：自動遷移會刪除尚未完整驗證的舊資料

dev `loadSpsWardrobe` 把能 JSON.parse 的舊 chunk 加入 `validLegacyChunks`；沒有完整確認格式版本和所有 outfit 記錄。不符合陣列格式的欄位被當成空陣列。稍後 `migrateLegacySpsWardrobe` 寫入候選 slot 後，便刪除這些舊 chunk。

需嚴格驗證整份來源、保留備份、確認目的資料與來源一致後才能考慮清理；無法辨識或部分損壞的記錄必須保留。先做可重複執行且不刪來源的遷移，再設計舊客戶端並存及回復流程。

### 高：session 身分仍不足以保護上傳後的寫入目標

dev `isCurrentSession` 只比較 activeSession 是否為同一物件；`applyToCharacter` 上傳結束後直接寫入 session 捕捉的 item。若遊戲或其他模組在等待期間替換裝備，session 不一定結束。`uploadSpsBlob` 又在 await 前後讀取全域 Player，沒有固定整個操作的帳號識別。

應於提交前重驗角色、帳號、裝備實體及權限；畫布／資料要取操作快照。Dev 的方向值得採用，但不能直接視為已解决所有非同步競態。

### 中：Blob URL 回收沒有確認圖片使用者

dev `spsDrawing.ts` 達到 96 筆即 revoke 最舊 URL，讀取命中時也不更新順序，實際較接近 FIFO。其他圖片／遮罩快取及 BC 仍可能持有該 URL；原碼沒有引用計數或同步失效機制。

應依[既有架構檢查](./architecture-review.md)設計引用與淘汰，再驗證超過 96 張、重新渲染和跨房的行為。容量上限本身不能證明回收安全。

### 中：舊圖讀取與認證邊界被一起改動

dev 從 `readSpsPublic` 移除 main 的 revision 查詢參數；v2/v3 仍讀取可覆寫的固定 key，不能因 v4 採用內容 key 就同時移除舊版的快取區分。dev 也刪除 npm OAuth adapter，改由 app 載入 vendor 腳本並依賴全域 studioOauth。此變更擴大啟動與維護責任，並非 timeout 或錯誤分類的必要條件。vendor README 的來源與校驗聲明尚未外部驗證。

### 中：現有測試入口不能被取代

dev 把 npm test 設為 `vitest run src` 並新增 Vitest，但該獨有提交未新增測試檔。main 的 scripts 回歸測試與新的 CI 必須保留；若確有需要引入測試框架，應另加入口，讓統一 test 同時執行既有測試。

## 分批交付建議

1. 從 main 建立功能分支，先做「衣櫃等待儲存成功」及載入／錯誤狀態，維持原儲存格式；以成功、拒絕、重複提交、切來源／帳號驗證。
2. 第二個 PR 做繪圖 session 與容量估算；保留現有繪圖格式，測試取消與儲存的本地預覽／房間同步差異。session 不能只拆改 slots.ts，所有非同步入口與退出路徑必須一起檢查。
3. 第三個 PR 做 SPS 請求層；使用模擬請求驗證 timeout、body 停滯、401、分頁、取消，不用真實衣櫃做故障實驗。
4. 內容 hash 圖片、衣櫃單槽格式及 metadata 雲端同步分別設計格式與遷移測試後，再決定是否開 PR；目前不採用 dev 的自動刪除與交易實作。

每批保留現有 lint、scripts tests、docs、architecture browser 與 build 門檻。儲存與繪圖還需新增針對實際失敗模式的測試，以及遊戲內驗收；架構圖瀏覽器測試不能替代功能驗收。

本輪已在同一分支進行上述功能修改；保留本審查作為設計依據，原 dev 的固定 journal、自動刪舊資料與 vendor OAuth 未採用。遠端 main、dev 與使用者雲端資料未修改。
