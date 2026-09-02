# 頭髮與五官變形白名單

## 用途與範圍

AEE 在 `src/core/bc.ts` 的 `TRANSFORM_GROUP_WHITELIST` 暫時開放以下原生群組：

| 群組 | 部位 |
| --- | --- |
| `HairFront` | 前髮 |
| `HairBack` | 後髮 |
| `Eyes`、`Eyes2` | 雙眼 |
| `Eyebrows` | 眉毛 |
| `Mouth` | 嘴巴 |

目前檢查的 BC 原始碼中，這些群組設定了 `AllowNone: false`，因此被原生 Layering 介面及 AEE 原先的判斷鎖住。但 `CommonDrawAppearanceBuild` 仍會讀取其原生位移、縮放與旋轉參數，交給遊戲渲染。

白名單只豁免 AEE `isGroupLocked()` 的 `AllowNone` 條件，讓數值控制、拖曳及變形工具使用既有編輯流程。它不修改遊戲的群組定義、卸除規則或原生 Layering 介面。`BodyUpper`、`BodyLower`、`Nipples`、`Head` 的鎖定，以及物件 `DynamicAfterDraw` 的限制仍然有效。

位移、縮放與旋轉沿用 `Item.Property` 的 `TranslationX/Y`、`ScaleX/Y`、`Rotation` 及各自的 `Layer*` 欄位；正常表情與眨眼由遊戲繪製。不新增頭髮或五官專用渲染器。斜切、翻轉與鏡像複製仍使用 AEE 既有的渲染擴充，不能視為原生客戶端支援的效果。

## ECHO 檢查結果

2026-09-02 檢查 `echo-clothing-ext-main/src/components/功能调整/身体区域.js`：

- `左眼_Luzi`、`右眼_Luzi`
- `新前发_Luzi`、`新后发_Luzi`
- `额外头发_Luzi`

以上自訂群組沒有設定 `AllowNone: false`；按 BC `AssetGroupAdd` 的預設，`AllowNone` 為 `true`，因此現有 AEE 判斷已允許編輯，暫不加入多餘的 ECHO 白名單。ECHO 加入原生頭髮／五官群組的資產則共用上方六個群組的例外。個別資產若有 `DynamicAfterDraw`，仍保留鎖定。

若未來 ECHO 改動群組註冊方式，應先確認執行時群組旗標與繪製流程，再針對確實受阻的頭髮／五官群組增加明確例外；不可用 `_Luzi` 後綴或全部 ECHO 群組作為全面開放條件。

## 白名單退場規則

**未來遊戲正式開放上述部位時，AEE 會逐一移除對應白名單。** 每次更新 BC 相容性時，應核對原生 `Layering._IsBlacklisted`／`_GetTabContents` 與群組定義；若遊戲改用新的判斷方式，也要同步調整 AEE 的一般判斷。

每個部位確認原生介面已開放、移除例外後 AEE 仍可正常編輯，再單獨刪除該群組並更新本文件。既有原生變形參數應保留，不因移除白名單清除角色設定。未獲原生支援的群組繼續保留例外；清單全數退場後刪除白名單分支。

遊戲內驗收應涵蓋儲存／重進、表情與眨眼、姿勢與鏡像、ECHO 覆蓋部位，以及另一個客戶端的顯示。原生參數的程式支援不等於已完成連線同步實測。
