# SPS 自由繪圖設計草案

本文件記錄 SPS 自由繪圖儲存與 Appearance 容量保護方案。SPS 公開容器、先上傳後同步、短引用及遠端快取已實作；全域 Appearance 容量保護仍僅保留設計。

## 儲存目標

- 本地圖片匯入不限制檔案容量。圖片進入畫布後會依自由繪圖畫格尺寸重新取樣；本地編輯流程不應套用 SPS 上傳限制。
- 只有玩家點擊右上角確認、準備同步 SPS 時，才輸出最終圖片並檢查容量。
- 三個自由繪圖槽共用一個 SPS 公開 key：`liko-aee:freedraw/1`。
- 每張最終圖片最多 `3,300,000` bytes。
- 三張合計最多 `9,900,000` bytes，低於 SPS 單 key 的 `10 MiB`（`10,485,760` bytes）限制。
- 上傳使用 `/public/data/liko-aee:freedraw/1`。私人 `/player/data` 無法讓其他玩家讀取。

## 單一二進位容器

單一 key 需要一個可驗證的二進位容器，而不是 Base64 JSON。建議格式：

1. 固定 magic/version，例如 ASCII `AEEFD1`。
2. 固定三個槽位索引。
3. 每槽記錄 MIME、內容雜湊、byte length 與原始圖片 bytes。
4. 解碼前驗證每槽不超過 3,300,000 bytes、總內容不超過 9,900,000 bytes。
5. 更新單一槽時先讀取目前容器、替換該槽，再以一次 PUT 原子覆寫整個 key。

其他玩家透過 Appearance 中的 `owner`、`slot`、`revision` 取得：

`GET /public/data/<owner>/liko-aee:freedraw/1`

同一位玩家、同一 revision 只下載一次容器，快取後供三個槽共用。取得圖片 bytes 後建立 Blob URL，再交給 AEE 現有的 GL／遮罩渲染流程。Blob URL 只存在本機，不可寫回 Appearance。

## Appearance 格式與同步流程

確認按鈕的預期流程：

1. 將目前畫布輸出為 PNG 或 WebP Blob。
2. 檢查最終 Blob 不超過 3,300,000 bytes。
3. 更新並上傳公開二進位容器。
4. 上傳成功後才刪除舊的 `Property.CustomDraw`。
5. Appearance 僅保存小型引用：owner、slot、revision、MIME 與公開 endpoint。
6. 最後才執行 `CharacterRefresh`、帳號保存與聊天室同步。
7. 上傳失敗時保持編輯器開啟，不修改人物 Appearance。

固定 key 會被覆寫，因此衣櫃中的舊服裝引用會顯示該槽的最新圖片。revision 用於快取失效，無法取回已覆寫的歷史圖片。

## 180K Appearance 檢查

自由繪圖改成 SPS 引用後，不應再在自由繪圖面板顯示 180K 容量，也不應由自由繪圖的確認函式負責整個人物 Appearance 的限制。

BC 的 `AccountUpdate` 仍可能因其他模組或道具資料超過約 180K。未來若重新加入保護，應放在共用的 AccountUpdate／人物保存層，於任何 Appearance 寫入前檢查完整的實際傳輸 payload，並以 toast 回報來源與大小。這是全域問題，不屬於 SPS 或自由繪圖功能。

## 尚未實作

- 自動批次遷移其他尚未重新確認的舊 `CustomDraw`。目前每個槽在玩家重新確認時個別遷移。
- Blob URL 的主動回收；目前由頁面工作階段結束時統一釋放。
- 全域 AccountUpdate 180K 保護。
