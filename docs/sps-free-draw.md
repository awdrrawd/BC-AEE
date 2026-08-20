# SPS 自由繪圖設計

自由繪圖預設保存在服裝的內嵌資料中，只有玩家手動選擇 SPS，或預估 AccountUpdate 達到 160K 安全線時才改用公開 SPS 引用。

## 儲存目標

- 本地圖片匯入不限制檔案容量。圖片進入畫布後會依自由繪圖畫格尺寸重新取樣；本地編輯流程不應套用 SPS 上傳限制。
- 只有玩家點擊右上角確認、準備同步 SPS 時，才輸出最終圖片並檢查容量。
- 身上三格分別使用 `liko-aee:FreeDraw/1` 至 `/3`，避免修改一格時重傳其他圖片。
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

`GET /public/data/<owner>/liko-aee:FreeDraw/<slot>`

同一位玩家、同一 revision 只下載一次。取得圖片 bytes 後建立 Blob URL，再交給 AEE 現有的 GL／遮罩渲染流程。Blob URL 只存在本機，不可寫回 Appearance。舊版 `liko-aee:freedraw/1` 三格容器仍可讀取。

## Appearance 格式與同步流程

確認按鈕的預期流程：

1. 先產生內嵌 PNG/LZ 資料並模擬完整 AccountUpdate。
2. 低於 140K 時直接內嵌保存；140K 起顯示黃色提醒。
3. 達 160K 時停止內嵌保存並詢問是否改用 SPS；玩家也可在左側手動選 SPS。
4. SPS 模式先檢查 Blob 不超過 3,300,000 bytes並上傳公開 key。
5. 上傳成功後才刪除 `Property.CustomDraw`，Appearance 改保存短引用。
6. 上傳失敗時保持編輯器開啟，不修改人物 Appearance。

收藏格只作為範本。調閱時把圖片複製到目前畫布，玩家確認後才寫入身上格或內嵌服裝，避免覆蓋收藏時連帶改變已穿服裝。

替別人換裝時，編輯者先上傳至獨立的 `FreeDrawTransfer/1` 至 `/3`，不覆蓋自己身上穿著的圖片。被換裝者的 AEE 收到後會驗證、下載，再使用本人的 OAuth 權限轉存至本人 `FreeDraw/<slot>`，最後替換成自己的引用。

## 180K Appearance 檢查

160K 是自由繪圖確認流程的預警及切換線，不是 BC 的硬限制。它為訊息包裝、其他道具 Property 與後續換裝預留空間。

BC 的 `AccountUpdate` 仍可能因其他模組或道具資料超過約 180K。未來若重新加入保護，應放在共用的 AccountUpdate／人物保存層，於任何 Appearance 寫入前檢查完整的實際傳輸 payload，並以 toast 回報來源與大小。這是全域問題，不屬於 SPS 或自由繪圖功能。

## 尚未實作

- 自動批次遷移其他尚未重新確認的舊 `CustomDraw`。目前每個槽在玩家重新確認時個別遷移。
- Blob URL 的主動回收；目前由頁面工作階段結束時統一釋放。
- 全域 AccountUpdate 180K 保護。
