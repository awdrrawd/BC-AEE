let root: ShadowRoot | null = null;
const pending: string[] = [];

const PROPERTY_FALLBACK_GATE = /@layer\s+properties\s*\{\s*@supports\s+[^{]+/;

function enablePropertyFallback(css: string) {
  return css.replace(PROPERTY_FALLBACK_GATE, '@layer properties{@supports (--tw:0)');
}

function inject(target: ShadowRoot, css: string) {
  const style = document.createElement('style');
  style.textContent = css;
  target.appendChild(style);
}

export function setShadowRoot(shadowRoot: ShadowRoot) {
  root = shadowRoot;
  pending.splice(0).forEach(css => inject(root!, css));
}

export function injectShadowCss(css: string) {
  const prepared = enablePropertyFallback(css);

  if (root) {
    inject(root, prepared);
  } else {
    pending.push(prepared);
  }
}