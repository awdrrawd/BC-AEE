<h1 align="center">🐈‍⬛ Liko-AEE — Appearance Editing Extension</h1>
<h3 align="center">外觀編輯拓展</h3>

<div align="center">

![Version](https://img.shields.io/badge/version-0.8.0-purple.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)
![BondageClub](https://img.shields.io/badge/BondageClub-Compatible-pink.svg)

</div>

一個 BondageClub UserScript 插件，為更衣室提供進階外觀編輯功能，包含旋轉、縮放、位移、透明度調整等。  
A BondageClub UserScript plugin providing advanced appearance editing — rotation, scaling, offset, opacity, and more.

---

## ✨ 功能 · Features

**🎨 圖層編輯 · Layer Editing**

逐圖層或整件衣服調整位移（X/Y）、旋轉、縮放（XY 等比/獨立）、傾斜（Skew）。  
Adjust position (X/Y), rotation, scale (proportional or independent), and skew per layer or for the whole item.

支援拖移操作：在更衣室畫面上直接拖動來調整，不需要輸入數值。  
Drag controls: directly drag on the canvas to adjust values without typing.

**🪞 鏡射與複製 · Mirror & Copy**

水平/垂直鏡射，以及水平/垂直鏡射複製（在對稱軸位置產生複製圖層）。  
Horizontal/vertical flip, and mirror copy (generates a mirrored duplicate at a configurable axis position).

**💧 透明度 · Opacity**

逐圖層獨立調整透明度，與 LSCG 相容，也可不依賴 LSCG 單獨使用。  
Per-layer opacity control, compatible with LSCG but works independently too.

**🎭 色彩選擇器 · Color Picker**

內建進階調色盤，支援 HSV 調整、色彩和諧（互補/三角/類比等）、漸層色板、已儲存色票。  
Built-in advanced color picker with HSV sliders, color harmony modes, shade gradients, and saved swatches.

支援滴管工具（EyeDropper API），可直接從螢幕取色。  
Supports EyeDropper API to pick colors directly from the screen.

可選擇取代 BC 原生調色盤。  
Optionally replaces the BC native color picker.

**🖼️ 圖層優先度 · Layer Priority**

逐圖層或整件衣服調整繪製優先度（Override Priority），即時預覽。  
Adjust drawing priority per layer or per item with live preview.

**👁 懸停閃爍 · Hover Highlight**

在 AEE 圖層清單或 BC 外觀清單懸停時，對應衣服在角色身上閃爍，方便確認位置。  
Hovering over a layer in the AEE list or BC appearance list flashes the corresponding item on the character.

**📦 外觀匯出/匯入 · Appearance Export/Import**

BCX 相容格式匯出外觀至剪貼板，匯入時可選擇只套用衣服、身體、或拘束具。  
Export appearance to clipboard in BCX-compatible format; import with category selection (clothes / body / restraints).

**🧍 視圖控制 · View Control**

提供獨立浮動面板（CharCtrl），含以下功能：  
Standalone floating panel (CharCtrl) with the following features:

- 人物位移（X/Y）與縮放，支援滾輪/鍵盤控制、小地圖拖移。  
  Character offset (X/Y) and scale with mouse wheel / keyboard support and minimap dragging.
- 背景：素色、格線（線格/棋盤）、圖片網址背景。  
  Background: solid color, grid (line/checker), image URL.
- POSE 快速選擇面板。  
  Quick pose selection panel.
- 特寫/全身畫面獨立隱藏。  
  Independent hide controls for closeup / fullbody view.

---

## 📦 安裝方式 · Installation

### 🐵 腳本管理器（推薦） · Script Manager (Recommended)
Tampermonkey / Violentmonkey

點擊以下連結直接安裝：  
Click the link below to install:

👉 **[Install Liko-AEE.user.js](https://github.com/awdrrawd/liko-Plugin-Repository/raw/refs/heads/main/Plugins/Liko-AEE.user.js)**

---

### 🧩 透過 PCM 管理器 · Via PCM Manager

若你已安裝 [Liko PCM](https://awdrrawd.github.io/liko-Plugin-Repository/)，可在插件列表中直接啟用 AEE，無需單獨安裝。  
If you have [Liko PCM](https://awdrrawd.github.io/liko-Plugin-Repository/) installed, enable AEE directly from the plugin list.

---

### 🔌 透過 FUSAM · Via FUSAM

1. 安裝 FUSAM（若尚未安裝）：https://sidiousious.gitlab.io/bc-addon-loader/  
   Install FUSAM if you don't have it yet: https://sidiousious.gitlab.io/bc-addon-loader/

2. 登入 BondageClub 後，前往主設定頁面點擊頂部的 **ADD-ON**。  
   After logging in, click **ADD-ON** at the top of the main settings page.

3. 在列表中找到 **Liko-AEE**，選擇版本後點擊 **Save**。  
   Find **Liko-AEE** in the list, select your preferred branch, and click **Save**.

4. 重新載入 BC。  
   Reload BondageClub.

---

### 🔖 書籤安裝 · Bookmarklet

建立新書籤，將以下程式碼貼入網址欄，在 BC 頁面點擊書籤即可載入：  
Create a new bookmark, paste the code below as the URL, then click it on the BondageClub page:

```javascript
javascript:(function(){
  var s=document.createElement('script');
  s.src="https://github.com/awdrrawd/liko-Plugin-Repository/raw/refs/heads/main/Plugins/Liko-AEE.user.js?"+Date.now();
  s.type="text/javascript";
  s.crossOrigin="anonymous";
  document.head.appendChild(s);
})();
```

---

### 💻 瀏覽器控制台 · Browser Console

開啟 F12，在 Console 分頁貼上以下程式碼：  
Open F12 DevTools and paste the following into the Console tab:

```javascript
import(`https://github.com/awdrrawd/liko-Plugin-Repository/raw/refs/heads/main/Plugins/Liko-AEE.user.js?v=${(Date.now()/10000).toFixed(0)}`);
```

---

## ⚠️ 注意事項 · Notes

旋轉、縮放、傾斜、鏡射為實驗性功能，不保證所有物件均完全相容。  
Rotation, scale, skew, and mirror are experimental features — full compatibility with all items is not guaranteed.

位移與透明度功能不依賴 LSCG，穩定性較高。  
Offset and opacity features do not depend on LSCG and are more stable.

---

## 🔧 相依 · Dependencies

- [bcModSdk](https://github.com/Jomshir98/bondage-club-mod-sdk) — 自動載入，無需手動安裝。Auto-loaded, no manual install needed.
- LSCG（可選 · Optional）— 安裝後部分功能可與其協同運作。Some features integrate with LSCG if installed.

---

## 📄 授權 · License

MIT License © Likolisu

使用本插件的程式碼時，請附上來源連結或保留版權聲明。  
When using code from this project, please include a link to the source or retain the copyright notice.

---

🐾 Made with 🐾 by **Likolisu**
