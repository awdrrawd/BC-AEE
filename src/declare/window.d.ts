interface LZStringLike {
  compressToBase64(input: string): string;

  decompressFromBase64(input: string): string | null;
}

interface EyeDropperResult {
  sRGBHex: string;
}

interface EyeDropperConstructor {
  new(): {
    open(options?: { signal?: AbortSignal }): Promise<EyeDropperResult>;
  };
}

interface Window {
  LSCG_Loaded?: boolean;
  LZString?: LZStringLike;
  EyeDropper?: EyeDropperConstructor;
  Liko: Record<string, unknown>;
}

interface StudioOauthToken {
  token: string;
  user: string;
  resources: string[];
  expires: number;
}

interface StudioOauthApi {
  login(client: string | null, resources: string[]): Promise<StudioOauthToken | null>;
  header(resource: string): Promise<string>;
}

declare let studioOauth: StudioOauthApi;
