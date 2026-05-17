export interface SelectionItem {
  id: string;
  assetIds: string[];
}

export interface SelectionUpdateInput {
  selectedAssetIds: Set<string>;
  orderedItems: SelectionItem[];
  targetItemId: string;
  anchorItemId: string | null;
  range: boolean;
}

export interface SelectionUpdate {
  selectedAssetIds: Set<string>;
  anchorItemId: string | null;
}

export interface AssetSelectionUpdateInput {
  selectedAssetIds: Set<string>;
  orderedAssetIds: string[];
  targetAssetId: string;
  anchorAssetId: string | null;
  range: boolean;
}

export interface AssetSelectionUpdate {
  selectedAssetIds: Set<string>;
  anchorAssetId: string | null;
}

export function updateSelectionForItem({
  selectedAssetIds,
  orderedItems,
  targetItemId,
  anchorItemId,
  range,
}: SelectionUpdateInput): SelectionUpdate {
  const targetIndex = orderedItems.findIndex((item) => item.id === targetItemId);
  if (targetIndex < 0) {
    return { selectedAssetIds: new Set(selectedAssetIds), anchorItemId };
  }

  const next = new Set(selectedAssetIds);
  const targetItem = orderedItems[targetIndex];
  if (!targetItem) {
    return { selectedAssetIds: next, anchorItemId };
  }

  const anchorIndex = anchorItemId ? orderedItems.findIndex((item) => item.id === anchorItemId) : -1;
  if (range && anchorIndex >= 0) {
    const from = Math.min(anchorIndex, targetIndex);
    const to = Math.max(anchorIndex, targetIndex);
    for (const item of orderedItems.slice(from, to + 1)) {
      for (const assetId of item.assetIds) next.add(assetId);
    }
    return { selectedAssetIds: next, anchorItemId: targetItemId };
  }

  const allSelected = targetItem.assetIds.length > 0 && targetItem.assetIds.every((assetId) => next.has(assetId));
  for (const assetId of targetItem.assetIds) {
    if (allSelected) next.delete(assetId);
    else next.add(assetId);
  }

  return { selectedAssetIds: next, anchorItemId: targetItemId };
}

export function updateSelectionForAsset({
  selectedAssetIds,
  orderedAssetIds,
  targetAssetId,
  anchorAssetId,
  range,
}: AssetSelectionUpdateInput): AssetSelectionUpdate {
  const targetIndex = orderedAssetIds.indexOf(targetAssetId);
  if (targetIndex < 0) {
    return { selectedAssetIds: new Set(selectedAssetIds), anchorAssetId };
  }

  const next = new Set(selectedAssetIds);
  const anchorIndex = anchorAssetId ? orderedAssetIds.indexOf(anchorAssetId) : -1;
  if (range && anchorIndex >= 0) {
    const from = Math.min(anchorIndex, targetIndex);
    const to = Math.max(anchorIndex, targetIndex);
    for (const assetId of orderedAssetIds.slice(from, to + 1)) next.add(assetId);
    return { selectedAssetIds: next, anchorAssetId: targetAssetId };
  }

  if (next.has(targetAssetId)) next.delete(targetAssetId);
  else next.add(targetAssetId);

  return { selectedAssetIds: next, anchorAssetId: targetAssetId };
}
