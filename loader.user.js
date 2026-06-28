// ==UserScript==
// @name Liko - AEE - Loader
// @namespace https://www.bondageprojects.com/
// @version 0.8.4
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

window.Liko = window.Liko ?? {};
if (window.Liko.AEE) {
  console.warn('🐈‍⬛ [AEE] ⚠️ Already loaded, skipping duplicate import.');
} else {
  window.Liko.AEE = true;
  import(`https://awdrrawd.github.io/BC-AEE/assets/main.js?v=` + new Date().getTime());
}
