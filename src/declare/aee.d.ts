namespace TextCache {
  let Text_Appearance: Record<string, string>;
}

type DialogMenuButtonTypeOverride = 'AEE_ClearCopy' | 'AEE_PartsFilter' | DialogMenuButtonType;
declare let AppearanceMenu: DialogMenuButtonTypeOverride[];

declare function CommonSetScreen(module: string, screen: string): Promise<void>;
