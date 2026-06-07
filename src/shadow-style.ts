let root: ShadowRoot | null = null;
const pending: string[] = [];

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
  if (root) {
    inject(root, css);
  } else {
    pending.push(css);
  }
}
