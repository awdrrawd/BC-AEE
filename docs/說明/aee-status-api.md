# AEE 狀態 API 與分享資料

[文件索引](../README.md) · [互動架構圖](https://awdrrawd.github.io/BC-AEE/docs/architecture/index.html)

## 公開 API

初始化後可透過 `window.Liko.AEE` 呼叫：

```js
const api = window.Liko?.AEE;
api?.isEnabled(character); // Character 或 MemberNumber → boolean
api?.getStatus(character); // {enabled, version, freeDraw}
api?.canUseGroup(character, 'ItemCanvas1'); // boolean
```

呼叫端應將 API 不存在、`enabled === false` 或尚未確認的對象視為不支援。`canUseGroup` 是額外的 AEE 能力檢查，不能取代 BC 原有的穿戴權限檢查。

四個使用者可見的自訂欄位為 `SingleGloveFX` 與 `ItemCanvas1`–`ItemCanvas3`。單手套需要即時確認 AEE；自由繪圖另需對方開啟 `enableFreeDraw`。繪圖的 Mask／Vis 輔助欄位採相同規則。普通 BC 群組不受此能力限制。未確認支援的對象一律隱藏這四個部位，即使已穿戴也不顯示；穿戴與移除入口採同一能力限制，不因狀態過期自動刪除物品。

## OnlineSharedSettings

```js
character.OnlineSharedSettings.AEE = {
  Version: '版本號',
  FreeDraw: true, // 自由繪圖開關；僅在即時確認 AEE 啟用後讀取
  ItemFont: '字型 ID', // 預設字型時省略
};
```

啟動後與選擇字型時，由同一個分享函式更新資料。原本頂層 `AEEItemFont` 會移除，改由本機目前的字型設定寫入 `AEE.ItemFont`。其他插件的欄位保留。新版讀取他人的 `AEE.ItemFont`；未升級客戶端僅提供舊欄位時，新版使用預設字型。

此物件會由帳號保存，因此只描述版本、字型與功能設定，**不能作為目前啟用的證據**，也不保存 `Enabled: true`。

## 即時確認與限制

`src/core/aeePresence.ts` 統一管理公開 API、字型分享及 mask 系統原有的對端判定，避免保留兩套名單。參考 WCE 的 `shareAddons.ts`／`hiddenMessageHandler.ts`：WCE 透過 Hidden hello 分享版本、能力與 SDK 插件清單，而非單靠帳號設定；AEE 額外加入確認期限及 request nonce。

- 聊天室內每 30 秒發出 `LikoAEE:status:` 隱藏請求，對方回覆到指定接收者。
- 只接受當前房間成員及未過期請求 nonce 的回覆（期限 30 秒）；多個未完成請求各自保存，不互相覆蓋。請求本身不證明對方支援；只在收到有效回覆後確認。
- 確認最多保留 75 秒。對方無預警停用、暫停或斷線時，可能在這段時間內仍顯示支援；背景分頁節流也可能讓仍啟用者暫時被視為不支援。
- 離房事件立即移除該成員。房間同步先清空名單，等待 BC 非同步載入成員完成後再重新確認。進入或重新載入後，在回覆抵達前不開放自訂欄位。
- 本機 SDK 中找不到 AEE 時，API 回傳未啟用，計時器不再發送。單純在 userscript 管理器關閉但未重載頁面，已執行的插件仍在執行，仍視為啟用。
- 舊版 AEE 的無期限 hello 不作為新版能力證據，雙方需升級至此協定。這是相容性判定，並非防惡意客戶端的安全驗證。

自由繪圖開關改變時先同步 `AEE.FreeDraw`，再發送能力變更通知，接收端重新握手確認，不直接信任通知中的能力值。

## 驗證

`node scripts/test-aee-presence.mjs` 涵蓋殘留設定、有效握手、舊 nonce、過期、離房、重新同步、SDK 卸載、字型分享、非 AEE 部位隱藏、穿戴與移除阻擋，以及普通 BC 部位不受影響。

`node scripts/test-aee-presence-network.mjs` 模擬兩個客戶端交換訊息，涵蓋三種啟用組合、即時切換、多請求與非同步進房。

外觀部位列表會直接隱藏不可用的自訂部位（包含「全部」篩選模式），不以長提示取代部位名稱，也不在進入畫面時彈出狀態通知。正常部位保留短名稱，設定的懸停描述說明完整規則。繪製與點擊共用篩選後的列表，離開呼叫後還原 BC 原始列表。

`getGroupBlockReason(character, group)` 仍供整合端取得不可用原因翻譯鍵；可用時回傳 null。未收到握手無法分辨未安裝與已停用 AEE，因此不宣稱一定未安裝。
