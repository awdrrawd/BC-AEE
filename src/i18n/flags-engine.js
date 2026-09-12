// Generated from liko-Plugin-Repository/Plugins/expand/BC_i18n.js; do not edit.
// flag-icons 7.3.2, MIT: https://github.com/lipis/flag-icons/blob/v7.3.2/LICENSE
(function () {
    if (typeof window === "undefined") return;
    window.Liko ??= {};
    function installFlags() {
        if (window.Liko.__Sys_Flags__) return;
        const version = '7.3.2';
        const base = `https://cdn.jsdelivr.net/npm/flag-icons@${version}/flags`;
        const countries = new Set(('ad ae af ag ai al am ao aq ar arab as asean at au aw ax az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bv bw by bz ca cc cd cefta cf cg ch ci ck cl cm cn co cp cr cu cv cw cx cy cz de dg dj dk dm do dz eac ec ee eg eh er es-ct es-ga es-pv es et eu fi fj fk fm fo fr ga gb-eng gb-nir gb-sct gb-wls gb gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu ic id ie il im in io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pc pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh-ac sh-hl sh-ta sh si sj sk sl sm sn so sr ss st sv sx sy sz tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug um un us uy uz va vc ve vg vi vn vu wf ws xk xx ye yt za zm zw').split(' '));
        const languageCountries = Object.freeze({ TW: 'tw', CN: 'cn', EN: 'gb', DE: 'de', FR: 'fr', RU: 'ru', UA: 'ua', JA: 'jp', KO: 'kr', VI: 'vn', ES: 'es', IT: 'it', PT: 'pt', PL: 'pl', NL: 'nl', TR: 'tr', SV: 'se', CS: 'cz', HU: 'hu', RO: 'ro', AR: 'sa', TH: 'th', ID: 'id', MS: 'my' });
        const defaultLanguages = ['TW', 'CN', 'EN', 'DE', 'FR', 'RU', 'UA', 'JA', 'KO', 'VI', 'ES'];
        const cache = new Map();
        const pending = new Map();
        const failures = new Map();
        function spec(country, format = '4:3') {
            const code = String(country ?? '').trim().toLowerCase();
            if (!countries.has(code)) throw new RangeError(`Unknown flag: ${code}`);
            if (!['4:3', '1:1', 'circle'].includes(format)) throw new RangeError(`Unknown flag format: ${format}`);
            const ratio = format === '4:3' ? '4x3' : '1x1';
            return { code, ratio, key: `${version}/${ratio}/${code}` };
        }
        function forLanguage(language) {
            if (typeof language !== 'string' || !/^[a-z]{2,3}(?:-[a-z0-9]+)*$/i.test(language.trim())) return null;
            return languageCountries[normalizeLang(language)] || null;
        }
        function supports(country) {
            return countries.has(String(country ?? '').trim().toLowerCase());
        }
        function get(country, format) {
            try { return cache.get(spec(country, format).key) || null; } catch { return null; }
        }
        function status(country, format) {
            let key;
            try { key = spec(country, format).key; } catch { return 'unsupported'; }
            return cache.has(key) ? 'ready' : pending.has(key) ? 'loading' : failures.has(key) ? 'error' : 'idle';
        }
        function ensure(country, format = '4:3') {
            let entry;
            try { entry = spec(country, format); } catch (error) { return Promise.reject(error); }
            const { key, ratio, code } = entry;
            if (cache.has(key)) return Promise.resolve(cache.get(key));
            if (pending.has(key)) return pending.get(key);
            const failure = failures.get(key);
            if (failure && Date.now() - failure.time < 5000) return Promise.reject(failure.error);
            const request = (async () => {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 15000);
                try {
                    const response = await fetch(`${base}/${ratio}/${code}.svg`, { signal: controller.signal, credentials: 'omit' });
                    if (!response.ok) throw new Error(`Flag ${code}: HTTP ${response.status}`);
                    const text = await response.text();
                    const xml = new DOMParser().parseFromString(text, 'image/svg+xml');
                    if (xml.querySelector('parsererror') || xml.documentElement.localName !== 'svg' || xml.documentElement.namespaceURI !== 'http://www.w3.org/2000/svg') throw new Error(`Invalid SVG: ${code}`);
                    // Render only as an image: never inject remote SVG markup into the game DOM.
                    const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
                    cache.set(key, url);
                    failures.delete(key);
                    return url;
                } catch (error) {
                    failures.set(key, { time: Date.now(), error });
                    throw error;
                } finally {
                    clearTimeout(timer);
                }
            })();
            pending.set(key, request);
            // Cleanup without creating an unhandled rejecting promise.
            request.then(() => pending.delete(key), () => pending.delete(key));
            return request;
        }
        async function create(country, { format = '4:3', size = 24, alt = '' } = {}) {
            if (!Number.isFinite(size) || size <= 0) throw new RangeError('Flag size must be positive');
            const url = await ensure(country, format);
            const img = document.createElement('img');
            img.src = url;
            img.alt = String(alt);
            img.width = size;
            img.height = format === '4:3' ? Math.round(size * 3 / 4) : size;
            img.style.objectFit = 'cover';
            if (format === 'circle') img.style.borderRadius = '50%';
            return img;
        }
        function preload(languages = defaultLanguages, format = '4:3') {
            return Promise.allSettled(languages.map(language => {
                const country = forLanguage(language);
                return country ? ensure(country, format) : Promise.reject(new RangeError(`No flag for language: ${language}`));
            }));
        }
        const labels = new WeakMap();
        const bitmaps = new Map();
        function parts(text) {
            const match = String(text).match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
            if (!match) return null;
            const country = [...match[0]].map(c => String.fromCharCode(c.codePointAt(0) - 0x1F1E6 + 97)).join('');
            return supports(country) ? { country, emoji: match[0], index: match.index } : null;
        }
        // Set only a dedicated label node, never a React-owned node or a container with controls.
        function renderLabel(element, text) {
            text = String(text);
            const token = {};
            labels.set(element, token);
            element.textContent = text;
            const flag = parts(text);
            if (!flag) return;
            create(flag.country).then(img => {
                img.style.cssText += ';width:1.33em;height:1em;vertical-align:-0.12em;object-fit:cover';
                img.onload = () => {
                    if (labels.get(element) !== token || element.textContent !== text) return;
                    element.replaceChildren(document.createTextNode(text.slice(0, flag.index)), img, document.createTextNode(text.slice(flag.index + flag.emoji.length)));
                };
                // Decode before replacing the visible emoji, including CSP / image load failures.
                if (img.complete && img.naturalWidth) img.onload();
            }).catch(() => {});
        }
        function draw(ctx, country, x, y, width, height) {
            if (!supports(country)) return false;
            const key = String(country).toLowerCase();
            let image = bitmaps.get(key);
            if (!image) {
                image = { pending: true };
                bitmaps.set(key, image);
                create(key).then(img => {
                    const failed = () => { image.failedAt = Date.now(); image.pending = false; };
                    img.onload = () => { image.img = img; image.pending = false; };
                    img.onerror = failed;
                    if (img.complete && img.naturalWidth) img.onload();
                }).catch(() => { image.failedAt = Date.now(); image.pending = false; });
            }
            if (image.img) { ctx.drawImage(image.img, x, y, width, height); return true; }
            if (!image.pending && Date.now() - image.failedAt > 5000) bitmaps.delete(key);
            return false;
        }
        const selects = new WeakMap();
        let closePicker = null;
        function bindSelect(select) {
            if (select.multiple || select.size > 1) return;
            if (selects.has(select)) { selects.get(select)(); return; }
            const original = { backgroundImage: select.style.backgroundImage, backgroundRepeat: select.style.backgroundRepeat,
                backgroundPosition: select.style.backgroundPosition, backgroundSize: select.style.backgroundSize, paddingLeft: select.style.paddingLeft };
            const savedLabels = new Map();
            let sequence = 0;
            let signature = '';
            let selectedNode = null;
            const sync = () => {
                const next = JSON.stringify([select.value, [...select.options].map(o => [o.value, savedLabels.get(o) || o.label])]);
                if (next === signature && selectedNode === select.selectedOptions[0]) return;
                signature = next;
                selectedNode = select.selectedOptions[0];
                const stamp = ++sequence;
                for (const [option, label] of savedLabels) { option.label = label; }
                savedLabels.clear();
                Object.assign(select.style, original);
                const option = select.selectedOptions[0];
                const label = option?.label || '';
                const flag = parts(label);
                if (!flag) return;
                create(flag.country).then(img => {
                    img.onload = () => {
                        if (stamp !== sequence || select.selectedOptions[0] !== option) return;
                        savedLabels.set(option, label);
                        option.label = label.replace(flag.emoji, '').trim();
                        Object.assign(select.style, { backgroundImage: `url("${img.src}")`, backgroundRepeat: 'no-repeat', backgroundPosition: '6px center', backgroundSize: '1.33em 1em', paddingLeft: '1.9em' });
                    };
                    if (img.complete && img.naturalWidth) img.onload();
                }).catch(() => {});
            };
            const open = event => {
                if (select.disabled || ![...select.options].some(o => parts(savedLabels.get(o) || o.label))) return;
                if (event.type === 'keydown' && ![' ', 'Enter', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
                event.preventDefault();
                closePicker?.();
                const rect = select.getBoundingClientRect();
                const menu = document.createElement('div');
                const style = getComputedStyle(select);
                menu.setAttribute('role', 'listbox');
                menu.setAttribute('aria-label', select.getAttribute('aria-label') || 'Language');
                menu.style.cssText = `position:fixed;z-index:2147483647;box-sizing:border-box;overflow:auto;max-height:45vh;padding:4px;border:1px solid currentColor;border-radius:6px;box-shadow:0 4px 16px #0008;`;
                Object.assign(menu.style, { left: `${Math.max(4, Math.min(rect.left, innerWidth - Math.max(rect.width, 180) - 4))}px`, top: `${Math.min(rect.bottom + 3, innerHeight * .5)}px`, minWidth: `${Math.min(Math.max(rect.width, 180), innerWidth - 8)}px`, maxWidth: 'calc(100vw - 8px)', background: style.backgroundColor === 'rgba(0, 0, 0, 0)' ? '#222' : style.backgroundColor, color: style.color, font: style.font });
                const controller = new AbortController();
                let removalObserver;
                const close = () => {
                    controller.abort(); removalObserver?.disconnect(); menu.remove();
                    delete select.dataset.likoFlagPicker;
                    select.setAttribute('aria-expanded', 'false');
                    if (closePicker === close) closePicker = null;
                    select.dispatchEvent(new Event('liko-flags-close'));
                };
                closePicker = close;
                select.dataset.likoFlagPicker = 'open';
                select.setAttribute('aria-expanded', 'true');
                const rows = [];
                for (const option of select.options) {
                    const row = document.createElement('button');
                    row.type = 'button'; row.disabled = option.disabled || !!option.parentElement?.disabled;
                    row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(option.selected));
                    row.style.cssText = 'display:block;box-sizing:border-box;width:100%;margin:0;text-align:left;padding:7px;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;';
                    renderLabel(row, savedLabels.get(option) || option.label);
                    row.onclick = () => { select.value = option.value; sync(); close(); select.dispatchEvent(new Event('input', { bubbles: true })); select.dispatchEvent(new Event('change', { bubbles: true })); select.focus(); };
                    menu.appendChild(row); if (!row.disabled) rows.push(row);
                }
                menu.onkeydown = e => {
                    const index = rows.indexOf(document.activeElement);
                    if (e.key === 'Escape') { e.preventDefault(); close(); select.focus(); }
                    else if (e.key === 'Tab') close();
                    else if (rows.length && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
                        e.preventDefault(); rows[e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length].focus();
                    }
                };
                document.body.appendChild(menu);
                removalObserver = new MutationObserver(() => { if (!select.isConnected || select.style.display === 'none') close(); });
                removalObserver.observe(document.body, { childList: true, subtree: true });
                removalObserver.observe(select, { attributes: true, attributeFilter: ['style'] });
                (menu.querySelector('[aria-selected="true"]:not(:disabled)') || rows[0])?.focus();
                document.addEventListener('pointerdown', e => { if (!menu.contains(e.target)) close(); }, { capture: true, signal: controller.signal });
                window.addEventListener('resize', close, { signal: controller.signal });
                window.addEventListener('scroll', e => { if (!menu.contains(e.target)) close(); }, { capture: true, signal: controller.signal });
            };
            select.addEventListener('pointerdown', open);
            select.addEventListener('keydown', open);
            select.addEventListener('change', sync);
            selects.set(select, sync);
            sync();
        }
        const api = { version: '1.1.0', assetVersion: version, languageCountries, forLanguage, supports,
            has: (country, format) => get(country, format) !== null, get, status, ensure, create, preload, renderLabel, draw, bindSelect };
        window.Liko.__Sys_Flags__ = api;
        // Keep blob URLs alive for the page lifetime; any plugin may still reference them.
        api.ready = preload();
        Object.freeze(api);
    }

    function normalizeLang(raw) {
        const low = String(raw).toLowerCase();
        let code = String(raw).toUpperCase().trim();
        // 中文各種寫法歸一：zh / zh-TW / zh-Hant → TW；zh-CN / zh-Hans → CN
        if (code === 'ZH' || low.startsWith('zh')) {
            code = (low.includes('tw') || low.includes('hant')) ? 'TW'
                 : (low.includes('cn') || low.includes('hans')) ? 'CN'
                 : 'TW';
        } else if (code.includes('-')) {
            code = code.split('-')[0];
        }
        // BC 用國家碼 JP/KR；統一成 ISO 639-1 語言碼 JA/KO（字庫檔名與各插件一致）
        if (code === 'JP') code = 'JA';
        else if (code === 'KR') code = 'KO';
        else if (code === 'UK' || code === 'UKR') code = 'UA';
        // 保留可辨識的語言碼，實際支援度由每個 namespace 已註冊的字庫決定。
        return /^[A-Z]{2,3}$/.test(code) ? code : 'EN';
    }

    installFlags();
})();
