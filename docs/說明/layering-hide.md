# 服裝隱藏（Layering Hide）

## 目的

AEE 允許使用者修改一件服裝原本會隱藏的外觀部位。設定跟隨服裝保存，不依賴 AEE 的一般偏好設定；只安裝 AEE 時也能套用，並與 WCE／LCE 使用的服裝格式相容。

## 顯示邏輯

可設定的部位來自服裝資產的 `Asset.Hide`。面板中的撥扭語意與 WCE 相同：

- 開啟：隱藏該部位。
- 關閉：顯示該部位。
- 尚未自訂：使用 `Asset.Hide`，因此預設項目全部開啟。

AEE 將自訂結果寫入服裝本身：

```ts
item.Property.wceOverrideHide = ["Bra", "Panties"];
```

陣列保存的是 `AssetGroupName`，不使用依賴順序的位元字串。即使遊戲日後調整 `Asset.Hide` 的順序，既有服裝仍會指向原本選擇的部位。

只要 `wceOverrideHide` 存在，它就完整取代該服裝的 `Asset.Hide`；空陣列表示這件服裝不隱藏任何部位。只有使用者按下「恢復道具預設」時才刪除 `wceOverrideHide`，重新使用資產預設值。手動設定即使剛好與當前預設相同，也會明確保留，避免資產預設日後改動時設定無預警改變。

AEE 在 `CharacterAppearanceVisible` 執行原生可見性判斷期間，暫時將每件服裝的覆寫值提供給遊戲，判斷結束後立即恢復共享的 Asset 定義。因此角色畫面與 AEE 衣櫃預覽會使用相同結果，也不會永久修改全域 Asset。

面板中的部位名稱使用遊戲已翻譯的 `AssetGroup.Description`；只有找不到對應群組時才退回內部群組名稱。

## 服裝與衣櫃保存

### 服裝資料

主要資料來源永遠是 `Item.Property.wceOverrideHide`。外觀複製、匯出及正常的 ItemBundle 流程會讓設定跟隨該件服裝。

### AEE 衣櫃

BC 的衣櫃壓縮格式可能受遊戲版本或其他插件的序列化處理影響，因此 AEE 在 `CharacterCompressWardrobe` 階段，還會將隱藏清單放進該項目的 AEE 額外資料：

```ts
{ AEE: 1, H: ["Bra", "Panties"] }
```

在 `CharacterDecompressWardrobe` 階段，AEE 會把 `H` 還原到 `Property.wceOverrideHide`。這是衣櫃序列化保險，不是另一套執行格式；載入完成後仍只由服裝 Property 決定顯示結果。

## 登入保存與 WCE 相容

WCE 為避免自訂欄位寫入 BC 帳號外觀資料庫，會在 `ServerPlayerAppearanceSync` 前從上傳用的外觀副本移除 `wceOverrideHide`，並把目前穿著的覆寫值保存到：

```ts
Player.ExtensionSettings.WCEOverrides
```

AEE 支援相同的壓縮格式：

```ts
{
  "Hide": {
    "ClothGroupName": ["Bra", "Panties"]
  }
}
```

使用者在 AEE 面板修改設定時，AEE 會同步指定的 `WCEOverrides` ExtensionSettings 鍵，作為目前穿著外觀的登入備援，不會發送整包 ExtensionSettings 或額外的 AccountUpdate 驗證。

登入載入外觀時的優先順序為：

1. 服裝已有 `Property.wceOverrideHide`：直接採用服裝資料，不覆蓋。
2. 服裝沒有該屬性，但 `WCEOverrides.Hide` 有相同服裝群組：從備援恢復。
3. 兩者都沒有：使用 `Asset.Hide`。

因此 AEE 單獨載入、與 WCE 同時載入或接手 WCE 已保存的設定時，都使用相同的服裝格式。

## 房間分享

`wceOverrideHide` 位於 Item Property，因此會隨正常的角色 Appearance／ItemBundle 更新傳到房間，不需要透過 ExtensionSettings 分享。`WCEOverrides` 只用於自己帳號的登入復原，其他玩家不能也不需要讀取它。

其他客戶端收到外觀後：

- 安裝 AEE、WCE 或支援相同格式的 LCE：讀取 `wceOverrideHide`，看到相同的隱藏結果。
- 未安裝相容插件：不認識此自訂屬性，仍依遊戲原始 `Asset.Hide` 顯示。

這項限制來自接收端的繪製邏輯；服裝 Property 可以分享設定，但不能讓未安裝支援程式的客戶端執行自訂判斷。

## 資料責任

| 資料位置 | 用途 | 是否為主要來源 |
| --- | --- | --- |
| `Item.Property.wceOverrideHide` | 實際顯示、服裝攜帶與房間分享 | 是 |
| 衣櫃額外欄位 `H` | 防止衣櫃壓縮／解壓縮遺失 | 否，僅序列化保險 |
| `ExtensionSettings.WCEOverrides` | 目前穿著外觀的登入復原與 WCE 相容 | 否，僅備援 |

