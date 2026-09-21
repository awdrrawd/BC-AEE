// Function excerpts from the supplied Bondage Club R132 release mirror (GameVersion R132, changelog 2026-09-16).
// Executable code is unchanged; upstream-only lint directives are omitted.
// Source: https://gitgud.io/BondageProjects/Bondage-College (Scripts/*).
// Executed in a VM by test-r132-compatibility.mjs; UI/asset registries are stubbed.

// Item.js SHA256 d0ac48f919447062cd00f037d695505dafbbdaeeb3d38fdfdd3b7db034bbcfe7
let ItemPropertiesDummy = null;

function ItemPropertiesCompress(item, options=null) {
	options ??= {};
	const allowLocks = options.allowLocks ?? true;
	if (!item?.Property) {
		return undefined;
	}

	// Initialize it with the known set of (legal) fully user-customizable properties
	const allowedProperties = new Set(ExtendedItemInitPropertyIgnore);
	// FIXME: Temporary backwards compatiblity.
	// Either port these properties over to BC or switch them out for a pre-existing BC equivalent.
	// @ts-expect-error
	allowedProperties.add("LayerOverrides"); // LSCG as of v0.8.17
	// @ts-expect-error
	allowedProperties.add("wceOverrideHide"); // WCE as of v6.3.19

	/** @type {ItemProperties} */
	const baseline = {};
	if (item.Asset.Extended) {
		for (const option of ExtendedItemGatherOptions(item)) {
			switch (option.OptionType) {
				case "VariableHeightOption":
					allowedProperties.add("OverrideHeight");
					break;
				case "TypedItemOption":
				case "ModularItemOption":
				case "VibratingItemOption":
					allowedProperties.add("TypeRecord");
					break;
			}
			Object.assign(baseline, option.Property ?? {}, option.ParentData.baselineProperty ?? {});
			for (const key of CommonKeys(option.ParentData.baselineProperty ?? {})) {
				allowedProperties.add(key);
			}
		}
	}

	if (item.Asset.AllowExpression) {
		baseline.Expression = null;
		allowedProperties.add("Expression");
	}

	lockedBy: if (allowLocks && item.Property.LockedBy) {
		const lockData = NoArchItemDataLookup[`ItemMisc${item.Property.LockedBy}`];
		if (!lockData) {
			break lockedBy;
		}

		Object.assign(baseline, lockData.baselineProperty ?? {});
		allowedProperties.add("LockedBy");
		allowedProperties.add("LockMemberNumber");
		allowedProperties.add("LockMemberName");
		allowedProperties.add("LockMessage");
		for (const key of CommonKeys(lockData.baselineProperty ?? {})) {
			allowedProperties.add(key);
		}
	}

	for (const prop of options.omit ?? []) {
		allowedProperties.delete(prop);
	}

	// Basic property validation is conducted later on via CraftingValidate
	/** @type {ItemPropertiesMinimized} */
	const ret = {};
	for (const key of allowedProperties) {
		switch (key) {
			case "TypeRecord": {
				let allDefault = true;
				/** @type {TypeRecord} */
				const typeRecord = {};
				for (const [k, v] of Object.entries(item.Property[key] ?? {})) {
					if (v) {
						allDefault = false;
						typeRecord[k] = v;
					} else {
						// TODO: Remove this `else` branch once R132 is live and rely on absent values implictly being 0
						// This is needed due to `ModularItemInit()` failing to handle partial typerecords prior to this commit (<= R131)
						typeRecord[k] = v;
					}
				}
				if (!allDefault) {
					ret[key] = typeRecord;
				}
				break;
			}
			default:
				if (item.Property[key] !== baseline[key]) {
					// @ts-expect-error
					ret[key] = item.Property[key];
				}
				break;
		}
	}
	return Object.values(ret).every(i => i === undefined) ? undefined : ret;
}

function ItemPropertiesDecompress(item, properties) {
	// For the sake of potential backwards compatibility issues both minimized and maximized properties must be handled
	/** @type {ItemPropertiesMinimized | ItemProperties} */
	const propertiesUnsanitized = properties ?? {};

	const C = ItemPropertiesDummy ??= CharacterLoadSimple("ItemBundleDummy");
	Object.assign(item.Property, propertiesUnsanitized);

	if (propertiesUnsanitized.LockedBy) {
		CommonArrayConcatDedupe(item.Property.Effect ??= [], ["Lock"]);
	}

	if (item.Craft?.Effects?.Painful) {
		CommonArrayConcatDedupe(item.Property.Fetish ??= [], ["Masochism"]);
	}

	if (item.Asset.Extended) {
		// Init will respect the `TypeRecord` values assigned further up above
		ExtendedItemInit(C, item, false, false);
	}
	return item.Property;
}


// ExtendedItem.js SHA256 1e400a7ac07732ffa85524423e4af0785d28d7259a1ead71b0dab3fcacb0c922
const ExtendedItemInitPropertyIgnore = new Set(/** @type {const} */([
	"OverridePriority",
	"DrawingTop",
	"DrawingLeft",
	"Opacity",
	"LayerTranslationX",
	"LayerTranslationY",
	"LayerScaleX",
	"LayerScaleY",
	"LayerRotation",
	"TranslationX",
	"TranslationY",
	"ScaleX",
	"ScaleY",
	"Rotation",
]));

const ExtendedItemGatherOptions = (function () {
	/** @type {(item: Item) => ExtendedItemOptionUnion[]} */
	function gatherOptions(item) {
		/** @type {ExtendedItemOptionUnion[]} */
		const options = [];
		const data = ExtendedItemGetData(item.Asset, item.Asset.Archetype);
		const typeKeySet = new Set(Object.keys(item.Property?.TypeRecord ?? {}));
		if (data) {
			_dfs(data, item, options, typeKeySet);
		}
		for (const unknownLeftoverKey of typeKeySet) {
			delete item.Property?.TypeRecord?.[unknownLeftoverKey];
		}
		return options;
	}

	/**
	 * Depth first search helper for gathering all (subscreen-embedded) extended item options
	 * @private
	 * @param {AssetArchetypeData} data - The extended item data
	 * @param {Item} item - The item in question
	 * @param {ExtendedItemOption[]} optionList - The to-be populated list of extended item options
	 * @param {Set<string>} typeKeySet - A set of all type record keys minus the ones that have already been visited
	 * @returns {void}
	 */
	function _dfs(data, item, optionList, typeKeySet) {
		/** @type {ExtendedItemOption[]} */
		const newOptions = [];
		const archetype = data.archetype;
		switch (archetype) {
			case ExtendedArchetype.NOARCH: {
				newOptions.push({
					Name: "NewOption",
					OptionType: "NoArchItemOption",
					ParentData: data,
					Property: Object.fromEntries(CommonKeys(data.baselineProperty ?? {}).map(k => [k, item.Property?.[k]]))
				});
				break;
			}
			case ExtendedArchetype.TEXT:
				newOptions.push(TextItemConstructOptions(data, item).newOption);
				break;
			case ExtendedArchetype.VARIABLEHEIGHT:
				newOptions.push(VariableHeightConstructOptions(data, item).newOption);
				break;
			case ExtendedArchetype.VIBRATING:
			case ExtendedArchetype.TYPED: {
				typeKeySet.delete(data.name);
				const index = item.Property?.TypeRecord?.[data.name] ?? 0;
				newOptions.push(data.options[index] ?? data.options[0]);
				break;
			}
			case ExtendedArchetype.MODULAR:
				newOptions.push(...data.modules.map(mod => {
					typeKeySet.delete(mod.Key);
					const index = item.Property?.TypeRecord?.[mod.Key] ?? 0;
					return mod.Options[index] ?? mod.Options[0];
				}));
				break;
			default:
				console.error(`Unsupported archetype: "${archetype}"`);
				break;
		}

		optionList.push(...newOptions);
		for (const option of newOptions) {
			if (option.ArchetypeData) {
				_dfs(option.ArchetypeData, item, optionList, typeKeySet);
			}
		}
	}

	return gatherOptions;
})();

function ExtendedItemInit(C, Item, Push=true, Refresh=true) {
	if (Item == null || C == null || !Item.Asset.Extended) {
		return false;
	}

	/** @type {Parameters<ExtendedItemCallbacks.Init>} */
	const args = [C, Item, Push, Refresh];
	return CommonCallFunctionByNameWarn(`Inventory${Item.Asset.Group.Name}${Item.Asset.Name}Init`, ...args);
}

function ExtendedItemCreateCallback(data, name, originalFunction) {
	const suffix = CommonCapitalize(name);
	const prefix = ["afterDraw", "beforeDraw", "scriptDraw"].includes(name) ? data.dynamicAssetsFunctionPrefix : data.functionPrefix;
	const funcName = `${prefix}${suffix}`;
	const scriptHook = /** @type {ExtendedItemScriptHookCallback<any, T, RT>} */(data.scriptHooks[name]);
	if (scriptHook != null) {
		/** @type {ExtendedItemCallback<T, RT>} */
		globalThis[funcName] = (...args) => scriptHook(data, originalFunction, ...args);
	} else if (originalFunction != null) {
		globalThis[funcName] = originalFunction;
	}
}

function ExtendedItemCreateCallbacks(data, defaults) {
	const dynamicDrawNames = /** @type {const} */(["beforeDraw", "afterDraw", "scriptDraw"]);
	/** @type {(keyof ExtendedItemCallbackStruct<T>)[]} */
	const ExtendedItemCreate = [
		"load",
		"click",
		"draw",
		"exit",
		"validate",
		"publishAction",
		"init",
		"setOption",
		...dynamicDrawNames,
	];

	const extraKeys = CommonKeys(defaults).filter(i => !ExtendedItemCreate.includes(i));
	if (extraKeys.length !== 0) {
		console.error(`Found ${extraKeys.length} non-existent script hooks in the passed ${data.asset.Name} extended item data`);
	}

	ExtendedItemCreate.forEach(k => ExtendedItemCreateCallback(data, k, /** @type {ExtendedItemCallback<any[], any>} */(defaults[k])));
	for (const name of dynamicDrawNames) {
		if (data.scriptHooks[name] || defaults[name]) {
			const asset = /** @type {Mutable<Asset>} */(data.asset);
			asset[`Dynamic${CommonCapitalize(name)}`] = true;
		}
	}
}

function ExtendedItemParseScriptHooks(scriptHooks) {
	return {
		load: typeof scriptHooks.Load === "function" ? scriptHooks.Load : null,
		click: typeof scriptHooks.Click === "function" ? scriptHooks.Click : null,
		draw: typeof scriptHooks.Draw === "function" ? scriptHooks.Draw : null,
		exit: typeof scriptHooks.Exit === "function" ? scriptHooks.Exit : null,
		validate: typeof scriptHooks.Validate === "function" ? scriptHooks.Validate : null,
		publishAction: typeof scriptHooks.PublishAction === "function" ? scriptHooks.PublishAction : null,
		init: typeof scriptHooks.Init === "function" ? scriptHooks.Init : null,
		setOption: typeof scriptHooks.SetOption === "function" ? scriptHooks.SetOption : null,
		beforeDraw: typeof scriptHooks.BeforeDraw === "function" ? scriptHooks.BeforeDraw : null,
		afterDraw: typeof scriptHooks.AfterDraw === "function" ? scriptHooks.AfterDraw : null,
		scriptDraw: typeof scriptHooks.ScriptDraw === "function" ? scriptHooks.ScriptDraw : null,
	};
}


// Server.js SHA256 02bf94e18d1162aef6d581a2f8f7f4e734098237e9acf8722a5d5c24073d942d
function ServerBundledItemFromAppearanceItem(item) {
	/** @type {undefined | ItemColor} */
	const inputColor = item.Color;
	/** @type {undefined | ItemColor} */
	let outputColor;
	if (ItemColorIsDefault(item)) {
		outputColor = undefined;
	} else if (CommonIsArray(inputColor) && inputColor.every(c => c === inputColor[0])) {
		outputColor = inputColor[0];
	} else {
		outputColor = inputColor;
	}

	const property = ItemPropertiesCompress(item);
	return {
		Group: item.Asset.Group.Name,
		Name: item.Asset.Name,
		Difficulty: !item.Difficulty ? undefined : item.Difficulty,
		Color: outputColor,
		Property: Object.keys(property ?? {}).length > 0 ? property : undefined,
		Craft: item.Craft,
	};
}

function ServerBundledItemToAppearanceItem(assetFamily, itemBundle) {
	if (!CommonIsObject(itemBundle) || typeof itemBundle.Name !== "string" || typeof itemBundle.Group !== "string") return null;

	const asset = AssetGet(assetFamily, itemBundle.Group, itemBundle.Name);
	if (!asset) return null;

	const item = AppearanceItem.fromAsset(asset, {
		difficulty: itemBundle.Difficulty,
		color: itemBundle.Color,
		craft: itemBundle.Craft,
	});
	item.Property = ItemPropertiesDecompress(item, itemBundle.Property);
	return item;
}


// NoArch.js SHA256 64eb577b0ca39a91abdd293a23145da8a4f9b037f7c4abe3cbf9f9d299db661e
const NoArch = {
Init: function (data, C, item, push=true, refresh=true) {
		if (!CommonIsObject(item.Property)) {
			item.Property = {};
		}

		let update = false;
		const baselineProperty = CommonCloneDeep(data.baselineProperty || {});
		for (const [name, value] of CommonEntries(baselineProperty)) {
			if (item.Property[name] === undefined) {
				update = true;
				Object.assign(item.Property, { [name]: value });
			}
		}

		if (update) {
			if (refresh) {
				CharacterRefresh(C, push, false);
			}
			if (push) {
				ChatRoomCharacterItemUpdate(C, item.Asset.Group.Name);
			}
		}
		return update;
	}
};
