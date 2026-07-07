// ==UserScript==
// @name Liko - AEE - Loader
// @namespace https://www.bondageprojects.com/
// @version 0.8.5
// @description Likolisu's Appearance editing extension.
// @author InkerBot & Liko
// @supportURL https://github.com/awdrrawd/BC-AEE
// @match https://bondageprojects.elementfx.com/*
// @match https://www.bondageprojects.elementfx.com/*
// @match https://bondage-europe.com/*
// @match https://www.bondage-europe.com/*
// @match https://bondageprojects.com/*
// @match https://www.bondageprojects.com/*
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
  import(`https://awdrrawd.github.io/BC-AEE/assets/main.js?v=` + new Date().getTime());
}
