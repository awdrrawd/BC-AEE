export type HsvColor = {
  h: number;
  s: number;
  v: number;
};

export type SavedColor = HsvColor & {
  a: number;
};
