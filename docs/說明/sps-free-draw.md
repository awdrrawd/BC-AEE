# SPS 自由繪圖設計

[文件索引](../README.md) · [互動架構圖](../architecture/index.html)

自由繪圖預設保存在服裝的內嵌資料中，只有玩家手動選擇 SPS，或預估 AccountUpdate 達到 160K 安全線時才改用公開 SPS 引用。

## 儲存目標

- 本地圖片匯入不限制檔案容量。圖片進入畫布後會依自由繪圖畫格尺寸重新取樣；本地編輯流程不應套用 SPS 上傳限制。
- 只有玩家點擊右上角確認、準備同步 SPS 時，才輸出最終圖片並檢查容量。
- 新圖片使用 `liko-aee:FreeDrawBlob/<SHA-256>`，Appearance 保存 v4 引用。同槽新畫不覆寫舊衣櫃引用的圖片；仍能讀取舊 v2/v3 固定槽位與舊三格容器。
- 身上圖片每張最多 `3,300,000` bytes。
- 30 格手動收藏使用 `liko-aee:FreeDrawData/1` 至 `/6`，每個二進位容器保存五格。
- 收藏圖片每張最多 `2,000,000` bytes；每個容器限制在 SPS 單 key 的 10 MiB 以內。
- 公開 `/public/data` 讓聊天室中的其他 AEE 用戶可以讀取；私人 `/player/data` 不適合圖片顯示。

## 收藏二進位容器

每個收藏 key 使用可驗證的二進位容器，而不是 Base64 JSON：

1. 固定 magic/version：ASCII `AEELB1`。
2. 固定五個槽位。
3. 每槽記錄名稱、MIME、SHA-256、byte length 與原始圖片 bytes。
4. 更新單格時只重寫所屬的五格容器。

身上圖片透過 Appearance 中的 `owner`、`slot`、`revision` 取得：

`GET /public/data/<owner>/liko-aee:FreeDrawBlob/<revision>`

同一 owner／slot／revision 的進行中下載共用 Promise，命中快取時不重下載。解碼來源使用 Data URL，AEE 的 LRU 最多保留 96 筆，淘汰時不會讓仍由 BC 或遮罩圖片快取引用的來源失效。Data URL 不寫回 Appearance；其他模組的圖片快取生命週期不由此 LRU 控制。

## Appearance 格式與同步流程

確認按鈕的預期流程：

1. 內嵌模式先產生 PNG/LZ 資料並模擬完整 AccountUpdate，估算失敗會阻止保存；SPS 模式直接輸出圖片，不先做內嵌編碼。
2. 低於 140K 時直接內嵌保存；140K 起顯示黃色提醒。
3. 達 160K 時停止內嵌保存並詢問是否改用 SPS；玩家也可在左側手動選 SPS。
4. SPS 模式先檢查 Blob 不超過 3,300,000 bytes並上傳公開 key。
5. 上傳成功後才刪除 `Property.CustomDraw`，Appearance 改保存短引用。
6. 上傳失敗時保持編輯器開啟，不修改人物 Appearance。

收藏格只作為範本。調閱時把圖片複製到目前畫布，玩家確認後才寫入身上格或內嵌服裝，避免覆蓋收藏時連帶改變已穿服裝。

替別人換裝時，編輯者先以自己的身分上傳內容 hash key。被換裝者的 AEE 驗證、下載後，再以本人的 OAuth 轉存同一內容 hash，替換成自己的引用；轉存前後均檢查帳號及穿戴物品仍有效。舊版 AEE 不支援 v4，顯示新引用需要更新。

繪圖編輯以 session 綁定角色、物品與帳號。載入／上傳／匯入後需再次驗證；同槽重開不接受前一次非同步結果。遮罩與優先度由 AEE 本地預覽，确认時才由 AEE 保存及廣播；取消或原生退出回復預覽。其他模組若在預覽期間自行保存整份 Appearance，仍需實機確認互動。

## 180K Appearance 檢查

160K 是自由繪圖確認流程的預警及切換線，不是 BC 的硬限制。它為訊息包裝、其他道具 Property 與後續換裝預留空間。

BC 的 `AccountUpdate` 仍可能因其他模組或道具資料超過約 180K。未來若重新加入保護，應放在共用的 AccountUpdate／人物保存層，於任何 Appearance 寫入前檢查完整的實際傳輸 payload，並以 toast 回報來源與大小。這是全域問題，不屬於 SPS 或自由繪圖功能。

## 尚未實作

統一追蹤於[未完成事項](../代改進/unfinished-items.md)。

- 自動批次遷移其他尚未重新確認的舊 `CustomDraw`。目前每個槽在玩家重新確認時個別遷移。
- 雲端未引用圖片的安全清理與配額管理；本版保留舊內容，不自動刪除。
- 舊版固定 key 已被覆寫且沒有備份的圖片無法由 v4 自動復原。
- 全域 AccountUpdate 180K 保護。
