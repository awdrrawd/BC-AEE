# GitHub Actions 與手動設定

[文件索引](../README.md) · [互動架構圖](https://awdrrawd.github.io/BC-AEE/docs/architecture/index.html)

設定日期：2026-09-12。程式與工作流已寫入專案；需要提交並推送到 GitHub 才會開始執行。本文件沒有宣稱已變更遠端 Settings 或成功部署。

## 自動執行內容

唯一的 CI／部署入口是 [ci.yml](../../.github/workflows/ci.yml)，顯示名稱為 **AEE CI**。原本的 `webpack.yml` 已移除，避免 main push 時出現兩套 Pages 部署。

| Job／服務 | 內容 | 失敗或警告的效果 |
| --- | --- | --- |
| `Code and docs` | `npm ci`、lint、所有 `scripts/test-*.mjs`、文件參照、翻譯報告 | lint／回歸／文件錯誤阻擋建置與部署；翻譯差異只警告，JSON 格式或值型別錯誤仍失敗。 |
| `Architecture browser` | Chromium 在 1280、1600、390 px 視窗驗證 16 個功能的 SVG 端點；另測舊網址轉跳、搜尋、檔案連結與縮放視窗 | 失敗阻擋建置與部署，保留截圖及 trace；HTML 報告保留 7 天。 |
| `Build` | 前兩個 job 通過後執行 TypeScript／Vite 建置、輸出 JS／CSS 原始及 gzip 體積、檢查 README 版本同步 | 失敗不部署。體積是該次提交的報告，目前不比較基準或設定阻擋門檻。 |
| `Deploy Pages` | 只部署同一次 main 工作流建置並上傳的 `dist/` artifact | 使用 `github-pages` environment；只有此 job 取得 `pages: write`、`id-token: write`。 |
| Dependabot | 每週一台北時間 09:00 檢查 npm 與 GitHub Actions | 建立更新 PR，不自動合併；npm minor／patch 分組，`bc-stubs` 與 major 更新獨立。 |

`pull_request` 指向 main 時執行檢查與建置；main push 執行檢查、建置與部署。Actions 頁面的 **Run workflow** 可手動執行；選擇 main 會在通過後部署，其他分支只檢查與建置。新的 PR 提交取消同一 PR 的舊檢查，main 執行不主動中止進行中的部署。

瀏覽器測試直接開啟本機 HTML，不需要 BC 帳號、遊戲伺服器或另起網站。這些測試不取代遊戲內及第三方模組驗收。`npm run build` 的 postbuild 會把架構圖與舊路徑轉址放入 `dist/docs/`，隨既有 Pages artifact 發布。Markdown 與原始碼仍在 GitHub 檢視；發布版架構圖中的檔案連結會指向倉庫。

## 你需要在 GitHub 設定的部分

1. **先提交、推送這批變更並合併到 main。** `package.json`、`package-lock.json`、scripts、tests、Playwright 設定、docs、兩份 `.github` YAML 都要一起提交；不要提交 `node_modules`、瀏覽器下載或測試報告。只有分支上的 `dependabot.yml` 不會啟用預設分支的定期更新。
2. **Settings → Actions → General：確認允許 GitHub Actions 執行。** 若有 action 白名單，須允許本工作流使用的 GitHub 官方 `actions/*`。不用將預設 Workflow permissions 改成整個儲存庫可寫；工作流自行為部署 job 宣告所需權限。
3. **Settings → Pages → Build and deployment → Source：選擇 GitHub Actions。** 如果原本就是此模式，保持即可。設定後第一次 main 執行會使用既有 Pages 網址。[GitHub 官方設定說明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
4. **Settings → Environments → github-pages：確認部署規則允許 main。** 建議 Deployment branches and tags 限定 main。若想要完全自動部署，不設定 Required reviewers；若你保留此審核規則，每次部署就需要手動批准。工作流已指定 environment，尚未存在時 GitHub 可以建立，但分支保護設定仍須你確認。
5. **建議啟用 main 合併門檻：Settings → Rules → Rulesets → New branch ruleset。** 將狀態設為 Active、目標設為 main，啟用 Require a pull request before merging 及 Require status checks to pass，加入 **Code and docs**、**Architecture browser**、**Build** 三個檢查。先讓工作流成功執行一次，再從 GitHub 列表選取實際的檢查名稱；不要把只在 main 執行的 Deploy Pages 加成 PR 必要檢查。建議要求分支與 main 保持最新。不需要強制指定其他人批准，單人維護也能使用。[Rulesets 官方說明](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)

沒有設定第 5 項時，CI 仍會執行且失敗不部署，但 GitHub 不一定阻止你合併失敗的 PR。Rulesets 是否可用依儲存庫可見性與方案而異，可依 GitHub 顯示的選項設定。

**不需要新增 PAT、npm token、BC 帳號或任何自訂 Secrets。** GitHub 提供工作流 token 與部署所需 OIDC。Dependabot 的版本更新由 [dependabot.yml](../../.github/dependabot.yml) 啟用；若另外想收到已知漏洞通知／修復 PR，可在 Settings 的 security 功能頁啟用 Dependabot alerts／security updates，這與每週版本更新是分開的設定。

## 本機執行與維護

建議 Node.js 22，CI 固定使用同一個 major。首次安裝與完整檢查：

```sh
npm ci
npm run lint
npm test
npm run check:docs
npm run check:i18n
npx playwright install chromium
npm run test:architecture
npm run build
npm run report:size
```

`npm test` 會自動收集 `scripts/test-*.mjs`，目前為 14 個功能回歸與 1 個 CI 檢查器測試；新增符合命名的腳本不需要修改 YAML。每個腳本在獨立 Node 程序執行，失敗或逾時會使整體失敗。

文件檢查涵蓋根 README、docs 下的 Markdown／HTML 靜態本地檔案或目錄參照，以及架構圖的來源檔案與功能 ID；大小寫也必須正確。它不連外查遠端網址、不解析 Markdown 章節錨點，也不是完整 Markdown 語法解析器。改變架構圖 `features` 資料格式時，須同步維護檢查器。

翻譯以執行期預設語言 EN 為參照，比對所有 locale（包含目前未開放選取的 AR）的缺少／多餘 key、空字串及 `{{variable}}` 參數；不判定翻譯語意或品質。要在本機嚴格攔截差異，可執行 `npm run check:i18n -- --strict`。

若本機 Chromium 下載暫時不可用，但已有 Edge，可在 PowerShell 使用：

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:architecture
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

這只影響本機選擇；GitHub Linux runner 仍安裝 Playwright Chromium。失敗時從 Actions 執行頁下載 `architecture-report`，解壓後執行 `npx playwright show-report <playwright-report 目錄>`。[Playwright CI 文件](https://playwright.dev/docs/ci-intro)

調整 `package.json` 版本後執行 `npm run sync-version` 並提交 README；Build 會檢查版本同步，避免 CI 產生未提交的版本修正。工作流不會自行 commit、push、合併更新 PR 或覆寫已追蹤的 dist 檔案；Pages 使用當次建置產物。

## 驗證狀態

- 本機 lint、正式 build、功能回歸與檢查器錯誤案例通過。
- 12 個語系目前 key、插值參數與空值檢查均無差異。
- 6 個 Playwright 測試在本機 Edge 通過，覆蓋 3 個視窗尺寸及全部 16 個功能。官方 Chromium CDN 本次下載逾時，Linux／Chromium 的結果須以首次 GitHub Actions 執行確認。
- YAML 已解析驗證；GitHub 託管 runner、Pages environment 和遠端權限尚未實際執行驗證。
