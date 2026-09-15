namespace TextCache {
  let Text_Appearance: Record<string, string>;
}

type AeeAppearanceMenuButtonType = 'AEE_ClearCopy' | 'AEE_PartsFilter' | 'AEE_HideRestraints' | 'AEE_LayerManager' | 'AEE_HoverTryOn' | 'AEE_CharacterPreview' | AppearanceMenuButtonType;
declare let AppearanceMenu: AeeAppearanceMenuButtonType[];

declare function CommonSetScreen(module: string, screen: string): Promise<void>;
