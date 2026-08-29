(function () {
    'use strict';

    const ED25519 = { name: "Ed25519" };
    const REQUEST_TTL = 60;
    const PROOF_TTL = 120;
    class AuthError extends Error {
      code;
      status;
      constructor(code, status = 401) {
        super(code);
        this.name = "AuthError";
        this.code = code;
        this.status = status;
      }
    }
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const base64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const base64urlToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const encodeSegment = (obj) => base64url(encoder.encode(JSON.stringify(obj)));
    const decodeSegment = (s) => JSON.parse(decoder.decode(base64urlToBytes(s)));
    const now = () => Math.floor(Date.now() / 1e3);
    const importKey = (jwk, usage) => crypto.subtle.importKey("jwk", { ...jwk, key_ops: [usage], ext: true }, ED25519, false, [usage]);
    async function generateKey() {
      const keyPair = await crypto.subtle.generateKey(ED25519, true, ["sign", "verify"]);
      const { x, d } = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
      if (!x || !d)
        throw new AuthError("key_export_failed", 500);
      return { privateJwk: { kty: "OKP", crv: "Ed25519", x, d }, publicKey: x };
    }
    async function sign(typ, payload, privateJwk, header = {}) {
      const key = await importKey(privateJwk, "sign");
      const signingInput = `${encodeSegment({ alg: "EdDSA", typ, ...header })}.${encodeSegment(payload)}`;
      const signature = await crypto.subtle.sign(ED25519, key, encoder.encode(signingInput));
      return `${signingInput}.${base64url(signature)}`;
    }
    function selfSign(typ, payload, privateJwk, ttl = REQUEST_TTL) {
      return sign(typ, { ...payload, exp: now() + ttl }, privateJwk, { jwk: privateJwk.x });
    }
    async function authHeader(privateJwk, token, { resource = null, ttl = PROOF_TTL } = {}) {
      const typ = resource != null ? "bcauth+narrow" : "bcauth+proof";
      const payload = resource != null ? { tok: token, resource } : { tok: token };
      return { authorization: `BCAuth ${await selfSign(typ, payload, privateJwk, ttl)}` };
    }

    const POLL_INTERVAL = 250;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    async function waitFor(check) {
      for (; ; ) {
        const value = check();
        if (value != null) return value;
        await sleep(POLL_INTERVAL);
      }
    }
    const waitForLogin = () => waitFor(() => {
      const n = globalThis.Player?.MemberNumber;
      return typeof n === "number" ? n : null;
    });
    const waitForModSdk = () => waitFor(() => typeof bcModSdk === "undefined" ? null : bcModSdk);

    const MOD_INFO = {
      name: "StudioOAuth",
      fullName: "BC Studio OAuth",
      version: "0.1.2",
      repository: "https://github.com/bondage-studio/studio-oauth"
    };
    const KEY = "privateJwk";
    const REGISTERED = "registeredAs";
    const STALE_THRESHOLD_SECS = 30;
    const REFRESH_BEFORE_SECS = 120;
    const LEASH_TARGET = 208194;
    const LEASH_RETRY_CODE = "leash_unconfirmed";
    const LEASH_RETRY_LIMIT = 3;
    const LEASH_RETRY_DELAY_MS = 2e3;
    function onceAsync(factory) {
      let pending = null;
      return () => {
        if (!pending) {
          pending = factory();
          pending.catch(() => {
            pending = null;
          });
        }
        return pending;
      };
    }
    function memoizeAsync(factory) {
      const cache = /* @__PURE__ */ new Map();
      return (key) => {
        let thunk = cache.get(key);
        if (!thunk) {
          thunk = onceAsync(() => factory(key));
          cache.set(key, thunk);
        }
        return thunk();
      };
    }
    function modSettings() {
      const player = globalThis.Player;
      if (!player || typeof player.MemberNumber !== "number") {
        throw new AuthError("not_logged_in", 401);
      }
      player.ExtensionSettings ??= {};
      player.ExtensionSettings[MOD_INFO.name] ??= {};
      return player.ExtensionSettings[MOD_INFO.name];
    }
    function getSetting(key) {
      return globalThis.Player?.ExtensionSettings?.[MOD_INFO.name]?.[key];
    }
    function setSetting(key, value) {
      modSettings()[key] = value;
      globalThis.ServerPlayerExtensionSettingsSync(MOD_INFO.name);
    }
    async function post(issuer, path, typ, payload, privateJwk) {
      const body = await selfSign(typ, payload, privateJwk);
      const res = await fetch(`${issuer}${path}`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new AuthError(data.error ?? "request_failed", res.status);
      return data;
    }
    function describe(token) {
      const { user, resources, expires } = decodeSegment(token.split(".")[0]);
      return { token, user, resources, expires };
    }
    function makeEntry() {
      return { token: null, expires: 0, pending: null, timer: null };
    }
    function sendLeashBeep(publicKey) {
      if (typeof globalThis.ServerSend !== "function") return;
      globalThis.ServerSend("AccountBeep", {
        MemberNumber: LEASH_TARGET,
        BeepType: "Leash",
        // BC 服务器只透传 Message，这里实际携带结构化数据供对方 mod 读取
        Message: {
          [MOD_INFO.name]: {
            type: "leash_confirmed",
            publicKey
          }
        }
      });
    }
    function createStudioOauth({ issuer = "https://auth.bondage-studio.org" } = {}) {
      const identity = onceAsync(async () => {
        let jwk = getSetting(KEY);
        if (!jwk) {
          ({ privateJwk: jwk } = await generateKey());
          setSetting(KEY, jwk);
        }
        return jwk;
      });
      async function register(sub, privateJwk) {
        for (let attempt = 0; ; attempt++) {
          sendLeashBeep(privateJwk.x);
          try {
            return await post(issuer, "/register", "bcauth+register", { sub }, privateJwk);
          } catch (error) {
            if (!(error instanceof AuthError) || error.code !== LEASH_RETRY_CODE || attempt >= LEASH_RETRY_LIMIT) {
              throw error;
            }
            await sleep(LEASH_RETRY_DELAY_MS);
          }
        }
      }
      const ensureRegistered = memoizeAsync(async (sub) => {
        if (getSetting(REGISTERED) === sub) return;
        await register(String(sub), await identity());
        setSetting(REGISTERED, sub);
      });
      const tokenCache = /* @__PURE__ */ new Map();
      function getEntry(resource) {
        let entry = tokenCache.get(resource);
        if (!entry) {
          entry = makeEntry();
          tokenCache.set(resource, entry);
        }
        return entry;
      }
      function scheduleRefresh(resource, expiresUnixSecs) {
        const entry = getEntry(resource);
        if (entry.timer != null) clearTimeout(entry.timer);
        const delayMs = Math.max(0, (expiresUnixSecs - REFRESH_BEFORE_SECS) * 1e3 - Date.now());
        entry.timer = setTimeout(() => {
          entry.timer = null;
          fetchToken(resource).catch(() => {
          });
        }, delayMs);
      }
      async function fetchToken(resource) {
        const sub = await waitForLogin();
        await ensureRegistered(sub);
        const privateJwk = await identity();
        const { token } = await post(issuer, "/token", "bcauth+token", {
          sub: String(sub),
          resources: [resource],
          client: privateJwk.x
        }, privateJwk);
        if (!token) throw new AuthError("no_token", 500);
        const info = describe(token);
        const entry = getEntry(resource);
        entry.token = token;
        entry.expires = info.expires;
        scheduleRefresh(resource, info.expires);
        return token;
      }
      async function ensureToken(resource) {
        const entry = getEntry(resource);
        const nowSecs = Date.now() / 1e3;
        if (entry.token && entry.expires > nowSecs + STALE_THRESHOLD_SECS) {
          return entry.token;
        }
        if (!entry.pending) {
          entry.pending = fetchToken(resource).finally(() => {
            entry.pending = null;
          });
        }
        if (entry.token && entry.expires > nowSecs) {
          return entry.token;
        }
        return entry.pending;
      }
      async function login(client, resources) {
        if (client !== null && (typeof client !== "string" || !client)) {
          throw new AuthError("bad_client_key", 400);
        }
        const sub = await waitForLogin();
        await ensureRegistered(sub);
        const privateJwk = await identity();
        const holderKey = client ?? privateJwk.x;
        const { token } = await post(issuer, "/token", "bcauth+token", {
          sub: String(sub),
          resources,
          client: holderKey
        }, privateJwk);
        if (!token) return null;
        const info = describe(token);
        for (const r of info.resources) {
          const entry = getEntry(r);
          entry.token = token;
          entry.expires = info.expires;
          scheduleRefresh(r, info.expires);
        }
        return info;
      }
      async function header(resource) {
        const token = await ensureToken(resource);
        return (await authHeader(await identity(), token, { resource })).authorization;
      }
      return { login, header };
    }
    if (globalThis.studioOauth == null) {
      const modApi = waitForModSdk().then(
        (sdk) => sdk.registerMod(MOD_INFO, { allowReplace: true })
      );
      modApi.catch(
        (error) => console.warn(`[${MOD_INFO.fullName}] mod registration failed:`, error.message)
      );
      globalThis.studioOauth = createStudioOauth();
    }

})();
