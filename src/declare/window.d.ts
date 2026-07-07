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
  LZString?: LZStringLike;
  EyeDropper?: EyeDropperConstructor;
  Liko: Record<string, unknown>;
}
