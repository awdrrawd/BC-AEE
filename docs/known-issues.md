# AEE 已知未完成項目

## 控制面板內容拖曳捲動

既有 AEE 控制面板捲動機制維持啟用，卷軸靠右顯示，並沿用 AEE 的主題色、軌道與滑塊樣式。

尚未完成的是讓這次 UI 改造涉及的三處卷軸——`control`、圖層管理、外觀匯入——都能從內容區按住任意物件後直接上下拖曳。既有的其他 AEE 捲動行為不在這項未完成範圍內，也不應被移除。

在重新實作並完成遊戲內滑鼠與觸控測試以前，請使用右側原生 scrollbar、滑鼠滾輪或裝置原生的捲動手勢。

> **範圍澄清**：下面「下拉選單拖曳捲動」一節說明的是 `Select`（如語言、懸停邊框選單）彈出的選項清單本身，這一小塊已經修好了。這裡指的「control 面板尚未完成」是指面板**其他一般內容**（設定列、圖層列等）按住任意物件拖曳捲動整個面板，兩者是不同的捲動目標，不要混為一談。

## 下拉選單（Select）拖曳捲動 — 已修復

### 問題

`src/components/ui/Fields.tsx` 的 `Select` 元件（`LanguageSelect`、`HoverOutlineSelect` 都共用它）展開的下拉清單，理論上會被 `src/core/dragScroll.ts` 掛在 `main.root` 上的全域 pointerdown capture 監聽器覆蓋到（判斷依據是 `.aee-scroll` class）。但因為這份清單巢狀在「control」設定面板裡，而 `control` 面板本身的拖曳捲動就是上面提到的三個未完成項目之一，導致下拉清單也連帶只能靠原生右側 scrollbar 捲動，按住拖曳沒有反應。

### 解法

不修改 `dragScroll.ts` 的全域機制，而是讓 `Select` 的下拉清單在展開時，直接對自己的 listbox DOM 元素呼叫既有的 `installDragScroll()`（這個函式本來就能接受任意元素當作根節點）：

```tsx
// src/components/ui/Fields.tsx
const listboxRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!open || !listboxRef.current) return;
  return installDragScroll(listboxRef.current);
}, [open]);
```

這讓下拉清單擁有自己保證一定生效的拖曳捲動，不再依賴「巢狀 class 是否被外層正確覆蓋」這個目前還沒做完的前提。

### 注意事項

- **`.aee-scroll` class 不能拿掉**：`installDragScroll` 內部仍然是用 `target.closest('.aee-scroll')` 找出實際要捲動的元素。如果哪天有人把 listbox 的 `aee-scroll` class 清掉，`closest()` 會往上層繼續找，可能誤抓到外層 `control` 面板的捲動容器，導致拖曳到錯誤的目標。
- **與外層 `main.root` 的全域監聽器會共存，這是預期行為**：`main.root` 上原本的全域 `installDragScroll` 仍然會抓到同一個 listbox（因為它也符合 `.aee-scroll` 比對），兩邊會各自獨立計算、各自設定同一份 `scrollTop`。由於兩邊讀到的起始座標相同、公式相同，結果不會衝突，只是有一點點重複運算，之後如果要重構請保留這個重疊，不必特別去重。
- **測試前務必確認載入的是「新 build」**：本專案是 Tampermonkey userscript，實際載入遊戲的是打包後的 `assets/main.js`，不是原始碼本身。
  - `loader.user.js`（正式版）固定抓遠端 `https://awdrrawd.github.io/BC-AEE/assets/main.js`，本機改原始碼**不會**反映在這裡。
  - `loader.local.user.js`（本地開發版）抓 `http://localhost:5174/assets/main.js`，測試修改前要先在專案根目錄跑 `npm run dev` 啟動本地伺服器，並確認 Tampermonkey 目前啟用的是這支本地版 loader，而不是正式版。
  - 改完程式碼後，可以到瀏覽器 DevTools 檢查該下拉清單的 `class` 屬性裡有沒有出現 `aee-scroll`，藉此確認目前跑的是不是最新 build（舊 build 沒有這行修改仍然會有這個 class，但如果整個 `main.js` 都是舊版，各種修改都不會生效，這是最快的排除盲點方式之一）。

## Control-panel drag scrolling

The existing AEE control-panel scrolling behavior remains enabled, with right-aligned scrollbars styled using the AEE theme.

Dragging vertically from arbitrary controls remains unfinished specifically for the three refactored areas: `control`, Layer Manager, and Appearance Import. Existing scrolling behavior elsewhere in AEE is outside this unfinished scope and must remain enabled.

> **Scope note**: the "Select dropdown drag-scrolling" section below is about the popped-open option list of a `Select` (e.g. the language and hover-outline dropdowns) — that specific piece is now fixed. The "control panel unfinished" item above refers to dragging the panel's **general content** (setting rows, layer rows, etc.), a different scroll target from the dropdown list itself.

## Select dropdown drag scrolling — Fixed

### Problem

The `Select` component in `src/components/ui/Fields.tsx` (shared by `LanguageSelect` and `HoverOutlineSelect`) pops open a listbox that, in principle, should be picked up by the global pointerdown capture listener installed on `main.root` in `src/core/dragScroll.ts` (matched via the `.aee-scroll` class). Because this listbox is nested inside the "control" settings panel, and that panel's own drag-scrolling is one of the three unfinished items noted above, the dropdown inherited the same limitation and could only be scrolled with the native right-hand scrollbar.

### Fix

Rather than touching the global mechanism in `dragScroll.ts`, the `Select` component now installs the existing `installDragScroll()` helper directly on its own listbox DOM node whenever it opens (the helper already accepts any element as its root):

```tsx
// src/components/ui/Fields.tsx
const listboxRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!open || !listboxRef.current) return;
  return installDragScroll(listboxRef.current);
}, [open]);
```

This gives the dropdown its own guaranteed-to-work drag-scroll behavior, independent of whether the host panel's own drag-scroll support has been finished yet.

### Things to watch out for

- **Don't remove the `.aee-scroll` class from the listbox.** `installDragScroll` still resolves the actual scroll target via `target.closest('.aee-scroll')`. If that class were ever removed, `closest()` would keep walking up the tree and could latch onto the outer `control` panel's own scroll container instead, scrolling the wrong element.
- **Coexisting with the global `main.root` listener is expected, not a bug.** The pre-existing global `installDragScroll` call still matches the same listbox (since it also satisfies the `.aee-scroll` selector), so both installations independently compute and set the same `scrollTop`. Since they read the same starting coordinates and use the same formula, this is redundant but harmless — no need to deduplicate this if refactoring later.
- **Always confirm you're testing a fresh build.** This project ships as a Tampermonkey userscript; the game loads the bundled `assets/main.js`, not the source directly.
  - `loader.user.js` (production) always fetches the remote `https://awdrrawd.github.io/BC-AEE/assets/main.js` — local source edits are **not** reflected here.
  - `loader.local.user.js` (local dev) fetches `http://localhost:5174/assets/main.js` — before testing a change, run `npm run dev` from the project root and make sure Tampermonkey has this local loader enabled instead of the production one.
  - After editing, inspect the dropdown's `class` attribute in DevTools for `aee-scroll` as a quick sanity check that you're actually running the latest build (an old build would still show this particular class, but if the whole `main.js` is stale, none of your edits will show up — checking this narrows down the problem fast).