# Icon organization

Icon ownership follows the feature that renders the icon. Feature code should import icons from the nearest `Icons.tsx` file instead of importing `lucide-react` directly.

- `components/icons/Icons.tsx`: genuinely shared UI icons.
- `components/main-panel/icons/Icons.tsx`: appearance editor and dressing-room toolbar.
- `components/wardrobe/icons/Icons.tsx`: wardrobe and wardrobe dialogs.
- `components/view-controls/Icons.tsx`: character, pose, offset, and background controls.
- `components/color-picker/Icons.tsx`: color picker.
- `components/layer-manager/Icons.tsx`: layer manager.
- `components/mask-system/icons.tsx`: free-draw canvas icons. These remain SVG strings/data URLs because Bondage Club draws them on canvas.

## Deferred items

- `components/overlays/RotationOverlay.tsx` contains functional interactive SVG, not an icon. Keep it with the overlay unless it becomes reusable.
- `components/main-panel/EditSection.tsx` contains a hidden functional SVG definition. Its ownership and runtime references must be verified before moving it.
- PNG files and Bondage Club `Icons/*.png` paths remain unchanged.
- `controllers/copyPasteIcons.ts` converts `lucide-static` SVG into canvas image data. Move it only after deciding whether it is shared canvas infrastructure or appearance-editor-specific.
- Existing editor SVG assets used by `ToolbarSide.tsx` should be moved only after their feature ownership and public asset URLs are verified.

