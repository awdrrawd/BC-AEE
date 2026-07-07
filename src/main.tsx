import {createRoot} from "react-dom/client";
import {StrictMode} from "react";
import '@/tailwind.css'
import '@/i18n/i18n';
import {setShadowRoot} from "@/shadow-style.ts";
import {installAeeHooks} from "@/hooks";
import {App} from "@/components/App";
import {AEE_ALREADY_LOADED} from "@/core/version";

const main: {
  shadowRoot?: ShadowRoot,
  resourceUrl: (path: string) => string,
  overlay?: HTMLElement,
  root?: HTMLElement
} = {
  resourceUrl: path => {
    const url = new URL(import.meta.url)
    url.pathname = url.pathname.substring(0, url.pathname.length - 'main.js'.length)
    url.pathname += path
    return url.toString()
  }
};

/*if (AEE_ALREADY_LOADED) {
  // Real duplicate-load guard lives here, in the bundle itself, so it
  // catches every path a second copy could get in through (loader, a
  // directly-installed full script, two loaders racing, etc.) - not just
  // the loader's own import call.
  console.warn('🐈‍⬛ [AEE] ⚠️ Already loaded, skipping duplicate import.');
} else {*/
  (async () => {
    main.overlay = document.createElement('div');
    document.body.appendChild(main.overlay);
    main.shadowRoot = main.overlay.attachShadow({mode: 'open'});
    setShadowRoot(main.shadowRoot);
    main.root = document.createElement('div');
    main.root.dataset.aeeRoot = 'true';
    main.shadowRoot.appendChild(main.root);

    createRoot(main.root).render(
      <StrictMode>
        <App/>
      </StrictMode>,
    );
    installAeeHooks();
  })().catch(console.error);
//}

export default main;
