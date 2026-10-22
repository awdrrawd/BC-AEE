# 上游與模組相容性追蹤

[文件索引](../README.md) · [互動架構圖](https://awdrrawd.github.io/BC-AEE/docs/architecture/index.html)

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

## BC 函式掛鉤追蹤

AEE 透過 ModSDK 掛鉤 60 多個 BC 函式。官方改了這些函式的內容，掛鉤就可能悄悄失效，因此用腳本比對，不靠人工逐一核對。做法與 AFC 的 `check:bc` 一致（同名指令、同名工作流程與標籤），但多了「內容有沒有變」的比對：AFC 只檢查目標是否存在，AEE 另外記錄每個函式的雜湊。

- `scripts/check-bc-compat.mjs` 掃描 `src/` 中的 `hookFunction`／`patchFunction`／`callOriginal` 等呼叫，從 BC 原始碼找出對應的頂層函式，以 ModSDK 相同的 CRC32 算出雜湊（與 `bcModSdk.getPatchingInfo()` 的 `originalHash` 同一算法，測試中以內建 ModSDK 驗證）。
- `Namespace.method` 形式的目標（class 或物件字面值）以原始碼文字雜湊；BC 在執行期才由 `<名稱>Hook` 函式產生的名稱（擴充物品）改查該函式，兩者在基準中標示，只用於偵測變動。
- 基準存放在 `scripts/bc-compat-baseline.json`（目前為 R133，來源提交 `9a6444123c85`），記錄每個函式的雜湊與所在檔案。
- 原始碼來源預設是[程式碼鏡像](https://github.com/awdrrawd/Bondage-College-Mirror/tree/bondageclub)的 `bondageclub` 分支；可用儲存庫變數 `BC_REPO_URL`、`BC_REF`（與 AFC 相同名稱）改成其他來源，手動執行時也能輸入分支或標籤。上游倉庫的檢出同樣支援。
- 每週由 [bc-compat.yml](../../.github/workflows/bc-compat.yml) 比對。有差異時建立或更新一則標籤為 `bc-compat` 的 issue，不阻擋 PR 與部署。

本機使用：

```sh
npm run check:bc -- --bc-dir <BC 原始碼資料夾>            # 與基準比對；有差異時結束碼為 1
npm run check:bc -- --bc-dir <BC 原始碼資料夾> --update   # 確認掛鉤仍正確後更新基準
```

被標示為「已改變」只代表函式內容不同，需要人工判斷掛鉤是否仍成立；「不再存在」代表掛鉤會安裝失敗。沒有 `--bc-dir` 時會使用倉庫根目錄下已被 `.gitignore` 排除的 `BondageClub/`。名稱在執行期才組出的掛鉤無法檢查，腳本會列出位置（AFC 另外支援 `for (const x of [...]) hook(x…)` 迴圈；AEE 目前沒有這種寫法）。

### R132 到 R133 的觀察（2026-10-23）

以鏡像的 R132 與 R133 版本比對，66 個被掛鉤的函式都仍存在，其中 9 個內容改變：`AppearanceMenuClick`、`ChatRoomSync`、`CommonDrawAppearanceBuild`、`DialogClick`、`DrawGetImage`、`GLDrawAppearanceBuild`、`GLDrawLoadImage`、`GLDrawLoadTextureAlphaMask`、`ItemColorLoad`。其中圖片載入與繪圖相關的幾個與 `bcImageCompat.ts` 處理的 R133 圖片快取變更相符；其餘尚未逐一檢視。

### bc-stubs 的取捨

`bc-stubs` 保留並升到 `133.0.0`（固定版本，不用範圍）：

- 它提供全部 BC 全域型別。實測移除後 `tsc` 出現約 1500 個錯誤，且它們有實際的把關作用：升到 133 時就抓出了 R133 的資料格式變更，見 [R132 相容性調整](../說明/r132-compatibility.md) 的 R133 一節。
- Dependabot 對 `bc-stubs` 開的是獨立 PR，型別有變動時 CI 的 `tsc` 會失敗，本身就是型別面的提醒；執行期的掛鉤變動則由上述每週比對負責。
- `package.json` 以 `overrides` 讓 `bc-stubs` 使用較新的 `socket.io-client`，因為它固定依賴含已知漏洞的 4.6.1（133 版也一樣），而它只用於型別。之後 `bc-stubs` 更新依賴後可重新評估是否還需要。
