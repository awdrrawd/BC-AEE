# 自由繪圖遮罩維護說明

本文件記錄 AEE 自由繪圖的顯示、遮罩與順位設計。修改相關程式前，請先確認下列行為仍然成立。

## 正確行為

自由繪圖有兩種互斥模式：

| 模式 | Vis 顯示物件 | Mask 遮罩物件 | 畫線本身 | 實際效果 |
| --- | --- | --- | --- | --- |
| 一般模式 | 穿戴 | 不穿戴 | 可見 | 畫線依順位顯示在人物上 |
| 遮罩模式 | 不穿戴 | 穿戴 | 不可見 | 只用畫線形狀挖空指定衣物 |

判斷遮罩是否成功的重要條件是：開啟遮罩後，原本的可見畫線必須消失。如果畫線仍顯示，它會蓋在被挖空的相同位置，使遮罩看起來像完全沒有作用。

## 資產分工

每個自由繪圖槽使用三個資產：

- `ItemCanvasN/DrawingBoard`
  - 編輯器入口。
  - 保存 `Property.CustomDraw`、位移與遮罩順位。
  - 不直接顯示圖片，也不負責遮罩。
- `ItemCanvasNVis/ItemCanvasNVisA`
  - 一般模式的可見圖片層。
  - 使用普通 `HasImage` layer。
  - `Property.OverridePriority` 控制畫線順位。
- `ItemCanvasNMask/ItemCanvasNMaskA`
  - 遮罩模式的隱藏 companion。
  - 使用 `HasImage: false` 與 `TextureMask` layer。
  - `Property.OverridePriority` 控制哪些衣物層會被遮罩。

`N` 目前為 1 至 3。

## BC 的處理方式

BC 會將普通顯示 layer 與 `TextureMask` layer 分開處理：

- `CharacterAppearanceSortLayers` 建立並排序普通顯示層。
- `CharacterAppearanceBuildMasks` 收集 `TextureMask` layer。
- `CommonDrawAppearancePrepareMaskLayers` 取得遮罩圖片、目標群組與遮罩順位。
- `GLDrawLoadTextureAlphaMask` 將遮罩來源合成後套用到目標衣物。

自由繪圖遮罩使用：

```ts
TextureMask: {
  Groups: MASK_TARGET_GROUPS,
  ApplyToAbove: false,
}
```

當 `ApplyToAbove` 為 `false` 時，Mask companion 的 `OverridePriority` 會參與 BC 的遮罩層篩選。因此改變順位後必須重新執行 `CharacterLoadCanvas` 或 `CharacterRefresh`，只修改 Property 不足以更新已建立的 `AppearanceLayers` 與 `AppearanceMasks`。

## 模式切換

`syncVisCompanion` 是 Vis／Mask 互斥狀態的唯一判斷點：

```ts
const shouldWear = hasDraw && !isSlotMasked(C, slot);
```

切換遮罩時必須依序完成：

1. 穿戴或移除 Mask companion。
2. 呼叫 `syncVisCompanion`，同步移除或恢復 Vis companion。
3. 清除自由繪圖 composite／遮罩快取。
4. 重新整理角色 canvas。
5. 同步 Mask 與 Vis 群組到聊天室。

取消編輯也必須執行相同的 Vis 狀態同步，否則編輯其他角色後取消，可能留下錯誤的 companion 狀態。

## 圖片與角色解析

BC 的圖片 URL 是全域快取，但自由繪圖內容屬於個別角色。圖片 provider 必須優先讀取目前正在建立 GL canvas 的角色：

```ts
const C = getBuildingChar() || safeCurrentCharacter();
```

不可直接在非同步回呼、GL provider 或 `DrawCharacter` hook 中呼叫 `CharacterGetCurrent()`。該函式在 `CurrentCharacter` 尚未初始化時仍然存在，但可能讀取 `CurrentCharacter.FocusGroup` 並拋出例外。

所有自由繪圖與單手套程式都應透過 `safeCurrentCharacter()` 取得目前角色。

## 快取規則

繪圖與遮罩 composite 必須以完整內容識別，不可只使用資料長度或短前綴。

PNG data URL 與壓縮後資料通常具有相同開頭；兩張不同圖片可能長度相同。使用短簽章可能造成：

- 新繪圖被誤判為已載入。
- 顯示舊圖片。
- 不同角色共用錯誤遮罩。
- 遮罩形狀更新失效。

相關快取已有 LRU 數量限制，因此使用完整壓縮內容作為 key，記憶體使用仍有上限。

## 不應恢復的舊作法

請避免重新加入下列設計：

- 在 `DrawCharacter` 完成後把畫線補畫到 `MainCanvas`。
  - 這會永遠位於人物最上層，使順位失效。
- 遮罩模式仍保留 Vis companion。
  - 可見線會覆蓋遮罩挖空區域，無法判斷遮罩效果。
- 讓 `DrawingBoard` 同時負責編輯資料、顯示與遮罩。
  - 會讓資產職責、URL provider 與快取互相干擾。
- 依賴 `DynamicAfterDraw` 作為唯一顯示路徑。
  - 動態 runtime 資產的 callback 在部分載入時序下不可靠。
- 只修改 `OverridePriority` 而不重建角色 canvas。
  - BC 已建立的 layer 排序不會自動更新。
- 直接呼叫 `CharacterGetCurrent()`。
  - 在聊天室或圖片載入回呼中可能拋出 `FocusGroup` 錯誤。

## 回歸測試清單

每次修改自由繪圖或遮罩後，至少測試以下項目：

1. 一般模式保存後，畫線會顯示在人物身上。
2. 一般模式調整順位後，畫線能移到不同衣物層的前後。
3. 開啟遮罩後，畫線本身消失。
4. 開啟遮罩後，畫線形狀會挖空目標衣物。
5. 遮罩順位改變後，被挖空的衣物層會跟著改變。
6. 關閉遮罩後，衣物恢復，畫線重新出現。
7. 取消編輯後，線條、遮罩開關與順位都恢復到進入編輯器前的狀態。
8. 三個自由繪圖槽可同時使用，且內容與順位不互相覆蓋。
9. 重新登入或完整重新整理後，繪圖、遮罩模式與順位仍正確。
10. 查看其他角色時，顯示的是該角色自己的繪圖與遮罩。
11. 編輯其他角色並保存／取消時，房間內同步結果正確。
12. 單手套遮罩仍正常，沒有受到共用 GL 圖片 hook 的影響。

完成修改後應執行：

```powershell
npm.cmd run lint
npm.cmd run build
git diff --check
```

## 編輯器預覽與順位

- 「畫布邊界」只是一個編輯器顯示選項，以藍色虛線標示可繪製區域，不會寫入物品資料或輸出圖片。
- 遮罩模式下，編輯器會以 40% 透明度顯示正在編輯的形狀，方便辨認遮罩範圍；真正的角色輸出仍只顯示遮罩結果，不顯示線條。
- 拖曳順位時會更新 companion 的 `Property.OverridePriority`，並以 80 ms 節流呼叫 `CharacterLoadCanvas`，讓 BC 重新建立 `AppearanceLayers`，因此不用保存就能看到排序結果。
- 編輯器在顯示 BC 的即時排序結果時，不可再把同一張畫布手動畫到 `MainCanvas` 最上方，否則畫面看起來永遠位於最上層。
- 全新畫布尚未保存時，DrawingBoard 還沒有 `Property.CustomDraw`。第一次編輯後必須暫時穿上 Vis companion，順位才有實際的 BC layer 可以排序。這只改變本地編輯狀態，不會提前保存或上傳；取消編輯時會恢復原狀。

## 為何不直接改用 BC Layering

BC Layering 的順位與本功能使用相同的底層資料：`Property.OverridePriority`。因此目前的順位不是自製排序演算法，而是直接交給 BC 的 `CharacterAppearanceSortLayers` 處理。

原生 Layering 額外提供 `TranslationX`、`TranslationY`、`ScaleX`、`ScaleY`、`Rotation` 和逐素材 layer 設定，但自由繪圖輸出是單張壓平 PNG，沒有多個內部素材 layer 可供獨立排序。AEE 也已統一處理畫布位移、縮放和旋轉，使 Vis 與 Mask 使用完全相同的幾何結果。

直接讓 Vis 與 Mask 各自接受 Layering 變形，會有線條與遮罩錯位、切換模式後設定不同步的風險。因此目前正確方案是：

- 順位繼續使用 BC 原生 `OverridePriority`。
- 幾何變形由 AEE 統一處理並同步套用到顯示與遮罩。
- 只有未來自由繪圖支援多個獨立素材 layer 時，才重新評估接入逐 layer 的 Layering 控制。
