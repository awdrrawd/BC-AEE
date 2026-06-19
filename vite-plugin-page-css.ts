import type {Plugin, ResolvedConfig} from 'vite';
import {join} from 'node:path';

const PAGE_SUFFIX = '?page';
const INLINE_SUFFIX = '?inline';

type CssTarget = 'page' | 'shadow';

export default function pageCssPlugin(): Plugin {
  let shadowStylePath: string;
  const meta = new Map<string, {target: CssTarget; filePath: string}>();

  return {
    name: 'page-css',
    enforce: 'pre',

    configResolved(config: ResolvedConfig) {
      shadowStylePath = join(config.root, 'src/shadow-style.ts').replace(/\\/g, '/');
    },

    async resolveId(source, importer) {
      if (source.includes(INLINE_SUFFIX)) return;

      let target: CssTarget;

      if (source.endsWith(PAGE_SUFFIX)) {
        target = 'page';
        source = source.slice(0, -PAGE_SUFFIX.length);
      } else if (source.endsWith('.css')) {
        target = 'shadow';
      } else {
        return;
      }

      const resolved = await this.resolve(source, importer, {skipSelf: true});
      if (!resolved) return;

      const id = `\0${resolved.id}.js`;
      meta.set(id, {target, filePath: resolved.id});
      return id;
    },

    async load(id) {
      const entry = meta.get(id);
      if (!entry) return;

      const {target, filePath} = entry;
      this.addWatchFile(filePath);

      if (target === 'shadow') {
        return `import css from ${JSON.stringify(`${filePath}${INLINE_SUFFIX}`)};import { injectShadowCss } from '${shadowStylePath}';injectShadowCss(css);export default css;`;
      }

      return `import css from ${JSON.stringify(`${filePath}${INLINE_SUFFIX}`)};const s = document.createElement('style');s.textContent = css;document.head.appendChild(s);export default css;`;
    },
  };
}
