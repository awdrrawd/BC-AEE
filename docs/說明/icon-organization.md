# Icon organization

圖示依用途分成四個大類，避免每個小功能各建一層轉送檔案：

1. **AEE**：`components/main-panel/icons/Icons.tsx` 統一匯出 Lucide 圖示；`EditorIcons.tsx` 與 `TransformIcons.tsx` 保存 AEE 自製 React SVG 元件。
2. **自由繪圖**：`components/mask-system/icons.tsx` 保存 SVG markup，並產生 data URL 給 BC Canvas `DrawButton` 使用。Canvas 不接受 React 元件，因此這一類不轉成 TSX 元件。
3. **衣櫃**：`components/wardrobe/icons/Icons.tsx` 匯出 Lucide 圖示；`LayoutIcon.tsx` 保存衣櫃自製 React SVG 元件。
4. **重複使用**：`components/icons/Icons.tsx` 放跨大類共用的 React 圖示；`components/icons/iconSources.ts` 集中 BC 內建 `Icons/*.png` 路徑。

## SVG 原則

- React UI 使用的 SVG 寫成 TSX 元件，透過 `currentColor` 繼承按鈕狀態，不再經過 `<img>` 與 CSS 反色。
- BC Canvas 使用的 SVG 保持 markup/data URL；例如自由繪圖與 `controllers/copyPasteIcons.ts`。
- Range input 的拖曳滑塊使用 `assets/aee/drag-slider.svg` 作為 CSS mask。CSS 需要可引用的資源 URL，因此保留 SVG 檔案。
- BC 原生 PNG 與角色資產預覽維持圖片 URL，不轉成元件。

`npm run lint` 會執行 `scripts/check-icon-organization.mjs`，拒絕在上述三個 React 類別入口以外直接引用 `lucide-react`，也會拒絕在 `iconSources.ts` 以外硬編碼靜態 BC 圖示路徑。動態姿勢路徑由 `viewController.ts` 依姿勢名稱組合，屬於明確例外。
