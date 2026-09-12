# DOCS 索引

[互動架構圖](./architecture/index.html) · [架構與擴充指南](./說明/architecture.md)

架構圖可在本機直接以瀏覽器開啟 `architecture/index.html`，不需安裝依賴。GitHub 的 Markdown 連結會開啟 HTML 原始碼頁；互動操作請使用本機瀏覽器。圖中的功能可透過網址片段（例如 `#transform`）直接定位。

## 代改進

保留使用者指定的資料夾名稱，集中尚未完成、需要修改程式的項目。

- [架構檢查與調整順序](./代改進/architecture-review.md)：模組邊界、循環依賴、資源生命週期與驗證缺口。
- [dev 分支審查與移植順序](./代改進/dev-review.md)：值得保留的功能、資料遷移風險與分批重作順序。
- [未完成事項](./代改進/unfinished-items.md)：面板動畫、舊繪圖批次遷移、Blob URL 回收、全域 AccountUpdate 容量保護。

## 說明

已實作功能的架構、資料格式與操作／維護說明。

- [GitHub Actions 與手動設定](./說明/github-actions.md)
- [架構與擴充指南](./說明/architecture.md)
- [互動式功能分支圖](./architecture/index.html)
- [外觀拾取與懸停](./說明/appearance-picking-and-hover.md)
- [AEE 狀態 API 與分享資料](./說明/aee-status-api.md)
- [設定與資料儲存原則](./說明/settings-storage.md)
- [自由繪圖遮罩](./說明/free-draw-mask.md)
- [SPS 自由繪圖](./說明/sps-free-draw.md)
- [圖層隱藏](./說明/layering-hide.md)
- [圖示管理](./說明/icon-organization.md)

## 持續追蹤

依上游版本、第三方模組或實機觀察決定後續動作的項目。

- [文字圖層變形與 LSCG 面板穩定性](./持續追蹤/upstream-compatibility.md)
- [頭髮與五官變形白名單](./持續追蹤/transform-whitelist.md)：逐一退場條件與待執行的遊戲內驗收。

整理日期：2026-09-12。已重新核對程式入口、文件連結與架構圖；遊戲內互動及第三方相容性仍依各追蹤文件驗收，不將程式碼檢查等同實機驗收。
