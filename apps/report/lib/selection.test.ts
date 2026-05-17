import assert from 'node:assert/strict';
import test from 'node:test';

import { updateSelectionForAsset, updateSelectionForItem, type SelectionItem } from './selection.ts';

const items: SelectionItem[] = [
  { id: 'cluster-a', assetIds: ['a1', 'a2'] },
  { id: 'cluster-b', assetIds: ['b1'] },
  { id: 'cluster-c', assetIds: ['c1', 'c2'] },
  { id: 'cluster-d', assetIds: ['d1'] },
];

test('普通点击切换当前候选的所有文件并建立锚点', () => {
  const selected = updateSelectionForItem({
    selectedAssetIds: new Set<string>(),
    orderedItems: items,
    targetItemId: 'cluster-a',
    anchorItemId: null,
    range: false,
  });

  assert.deepEqual([...selected.selectedAssetIds].sort(), ['a1', 'a2']);
  assert.equal(selected.anchorItemId, 'cluster-a');

  const deselected = updateSelectionForItem({
    selectedAssetIds: selected.selectedAssetIds,
    orderedItems: items,
    targetItemId: 'cluster-a',
    anchorItemId: selected.anchorItemId,
    range: false,
  });

  assert.deepEqual([...deselected.selectedAssetIds], []);
  assert.equal(deselected.anchorItemId, 'cluster-a');
});

test('Shift 点击按当前顺序把锚点到目标之间的候选加入选择', () => {
  const selected = updateSelectionForItem({
    selectedAssetIds: new Set(['outside']),
    orderedItems: items,
    targetItemId: 'cluster-d',
    anchorItemId: 'cluster-b',
    range: true,
  });

  assert.deepEqual([...selected.selectedAssetIds].sort(), ['b1', 'c1', 'c2', 'd1', 'outside']);
  assert.equal(selected.anchorItemId, 'cluster-d');
});

test('Shift 点击找不到锚点时退化为普通点击', () => {
  const selected = updateSelectionForItem({
    selectedAssetIds: new Set<string>(),
    orderedItems: items,
    targetItemId: 'cluster-c',
    anchorItemId: 'missing',
    range: true,
  });

  assert.deepEqual([...selected.selectedAssetIds].sort(), ['c1', 'c2']);
  assert.equal(selected.anchorItemId, 'cluster-c');
});

test('Gallery 普通点击或 Cmd/Ctrl 点击切换单张图片并建立锚点', () => {
  const selected = updateSelectionForAsset({
    selectedAssetIds: new Set(['outside']),
    orderedAssetIds: ['a1', 'a2', 'a3'],
    targetAssetId: 'a2',
    anchorAssetId: null,
    range: false,
  });

  assert.deepEqual([...selected.selectedAssetIds].sort(), ['a2', 'outside']);
  assert.equal(selected.anchorAssetId, 'a2');

  const deselected = updateSelectionForAsset({
    selectedAssetIds: selected.selectedAssetIds,
    orderedAssetIds: ['a1', 'a2', 'a3'],
    targetAssetId: 'a2',
    anchorAssetId: selected.anchorAssetId,
    range: false,
  });

  assert.deepEqual([...deselected.selectedAssetIds], ['outside']);
  assert.equal(deselected.anchorAssetId, 'a2');
});

test('Gallery Shift 点击按图片顺序追加锚点到目标之间的范围', () => {
  const selected = updateSelectionForAsset({
    selectedAssetIds: new Set(['outside']),
    orderedAssetIds: ['a1', 'a2', 'a3', 'a4'],
    targetAssetId: 'a4',
    anchorAssetId: 'a2',
    range: true,
  });

  assert.deepEqual([...selected.selectedAssetIds].sort(), ['a2', 'a3', 'a4', 'outside']);
  assert.equal(selected.anchorAssetId, 'a4');
});
