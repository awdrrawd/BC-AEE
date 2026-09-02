# 上游與模組相容性追蹤

以下沿用既有文件的觀察，整理日期為 2026-09-02；版本預期不代表已確認發布或修復。

## 文字圖層變形

### 目前狀態

- AEE 不對具有 `Text`、`Text2`、`Text3` 的 `DynamicAfterDraw` 道具解除變形鎖定。
- 曾測試允許編輯原生 `TranslationX`／`TranslationY` 等數值，但 R131 的文字渲染沒有套用位移，因此已撤回 UI 與例外判斷。

### 後續條件

- R132 預計由官方接手文字圖層的變形渲染。
- R131 後續也可能提前修復，需以實際遊戲版本測試為準。
- 官方能正確渲染前，不應再次提供只有數值變化、畫面沒有變化的編輯入口。
- 官方支援後應直接使用原生 Layering properties，不另建 AEE 私有文字位移格式。

## LSCG 圖層面板隱藏穩定性

### 目前狀態

- AEE 會檢查 LSCG Global／Opacity 模組及 AEE 替代工具是否存在。
- `MutationObserver` 會處理 LSCG 延遲建立或重新建立 `#lscg-layers` 的情況。

### 後續觀察

若仍出現短暫閃現，應考慮與 LSCG 協作，在 `OpacityModule.ShowDomUI()` 前加入可取消事件，從建立來源阻止面板，而不是在 DOM 建立後隱藏。
