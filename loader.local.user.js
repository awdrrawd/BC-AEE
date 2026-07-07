// ==UserScript==
// @name Liko - AEE - 本地版
// @namespace https://www.bondageprojects.com/
// @version 0.1
// @description Likolisu's Appearance editing extension. (local dev loader)
// @author InkerBot & Liko
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant none
// @run-at document-end
// ==/UserScript==

// The real duplicate-load guard lives in the bundle itself (src/core/version.ts),
// so it still catches every case - including someone installing both this
// loader and a directly-installed full copy of the script. This check here
// is just an early, pre-download warning; it doesn't own the flag.
window.Liko = window.Liko ?? {};
if (window.Liko.AEE) {
  console.warn('🐈‍⬛ [AEE] ⚠️ Already loaded, skipping duplicate import.');
} else {
  import(`http://localhost:5174/assets/main.js?v=` + new Date().getTime());
}

// Local dev loader: reads the bundle from the local vite preview server.
// The ?v= timestamp busts the cache so every reload picks up the latest build.
// Run ` npm run dev ` , then reload BC.