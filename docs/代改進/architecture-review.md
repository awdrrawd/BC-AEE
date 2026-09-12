# 架構檢查與調整順序

[文件索引](../README.md) · [互動架構圖](../architecture/index.html) · [架構指南](../說明/architecture.md)

檢查日期：2026-09-12。範圍是目前工作樹的程式入口、模組依賴、生命週期、文件與建置流程；不包含遊戲伺服器或第三方模組的實機驗收。

## 結論

現有 hooks → controllers → core 與 React UI 的分工足以支援目前功能，建議逐步收斂責任，無須整個重寫或立刻改成全新的目錄架構。優先處理可驗證的資源生命週期與大型 controller，再考慮搬動檔案。下表保留檢查結果與調整方向；第 5 項已完成本地實作，其餘仍為改善建議。

| 順序 | 現況與證據 | 建議及完成條件 |
| --- | --- | --- |
| 1 | `components/mask-system/freeDraw/spsDrawing.ts` 已改用 96 筆 Data URL LRU，淘汰不撤銷其他渲染器仍使用的來源；短期匯入 URL 維持回收。 | 繼續實機量測 BC 與遮罩等下游快取；驗證換槽、跨房與超過 96 張後圖片正確，總記憶體不持續增加。 |
| 2 | `controllers/uiController.ts` 同時管理 Property 編輯、面板定位、懸停與試穿，已有 1081 行；`appearancePickerController.ts` 有 865 行，結合 capture、命中測試、外框與 UI 狀態。 | 依功能拆出 hover／try-on 與編輯命令，保留原公開 API 作轉接；幾何純函式繼續集中 `core/pickerTransform.ts`。以現有 hover、transform、item identity 回歸腳本確認行為。行數只是定位線索，不是單獨拆檔的理由。 |
| 3 | `features/mask/index.ts` 只有兩個轉匯出，真實功能與儲存仍在 `components/mask-system/`，hooks 也直接匯入其 access 模組。 | 先補足功能公開入口，減少外部對內部路徑的直接依賴，再逐步搬移非 UI 模組到 `features/mask/`；UI 留在 components，遷移一組就測一組。 |
| 4 | `hooks/index.ts` 集中初始化，但 `app.tsx` 沒有統一卸載流程；WebGL prototype 包裝保留至頁面結束，各 listener、timer、cache 的清理由功能自行管理。 | 如果需要熱重載或動態停用，讓安裝函式回傳可重複執行的 dispose，集中反向清理；還原 prototype 前確認仍是自己的 wrapper，避免覆蓋其他模組。首次安裝、重複安裝、停止後重啟均須驗證。 |
| 5 | 已加入統一 `npm test`、PR／main 的 lint／tests／docs／browser／build，並以檢查結果控制 Pages 部署。 | 本地驗證已通過；推送後確認第一次 GitHub 執行，並依[設定說明](../說明/github-actions.md)啟用 main 合併門檻。 |
| 6 | 正式建置的 `app.js` 約 1.54 MB（gzip 約 579 KB），超過現有 1000 KB 警告門檻；動態 bootstrap 仍載入單一大型 app chunk。 | 先量測載入時間與常用功能，再評估衣櫃、搜尋器或調色盤的延遲載入；保留遊戲 hooks 安裝順序，確認 userscript 跨來源載入正常，不以提高門檻代替改善。 |

## 不應誤判的地方

- `settings.ts` 對 `theme.ts` 的 `UiStyle` 是 `import type`；反向的 settings 值匯入不構成同等的執行期循環。不能僅因文字掃描出環就當成初始化錯誤。
- `core` 目前兼任共享狀態與 React 訂閱，不是純領域層；若日後要在非 React 環境重用，才將 subscription hook 與狀態本體分離。
- 部件搜尋器唯讀使用 BC 資產與圖片介面，可維持單一 UI 功能；新增 controller 應有可共享的流程或副作用責任。
- 白名單、LSCG 與 BC 上游限制仍在[持續追蹤](../持續追蹤/upstream-compatibility.md)，不能以本次靜態檢查宣稱已解決。

## 本次已處理

- 修復架構圖 SVG 與節點座標系不一致造成的連線偏移。
- 統一架構圖入口，補齊 Markdown 導覽、設定儲存文件索引，保留舊路徑轉跳。
- 說明實際啟動順序、分層例外、WebGL 生命週期與文件發布範圍。
- 圖中提供完整節點提示與功能網址片段；移除不可直接開啟的萬用字元檔案連結。

## 本次驗證

- `npm run build`、`npm run lint`、14 個 `scripts/test-*.mjs` 均通過。
- 建置仍有上述 chunk 大小警告；遊戲內及第三方相容性未實機驗收。
- 瀏覽器量測一般、寬版與手機版圖面（957／1292／920 CSS px），所檢查的連線端點誤差均為 0；手機版以橫向捲動保留三欄結構。
