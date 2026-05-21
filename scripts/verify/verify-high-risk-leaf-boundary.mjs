#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

const contracts = [
  {
    name: 'PhotoGridScreen',
    file: 'src/ui/screens/PhotoGridScreen.tsx',
    markers: [
      'usePhotoGridSessionController',
      'PhotoGridSkeleton',
      'PhotoGridDetailFlow',
      'PhotoGridWorkspace',
      "BackHandler.addEventListener('hardwareBackPress'",
      'handleSelectionChange',
      'onSelectionChange={handleSelectionChange}',
      'handleCleanupSelected',
      'handleKeepSelected',
      'photo-grid-loading-overlay',
      'photo-selection-toggle-button',
      'cleanup-selected-button',
      'keep-selected-button',
      'scan-result-grid',
      'scan-result-grid-item',
    ],
  },
  {
    name: 'RecycleBinScreen',
    file: 'src/ui/screens/RecycleBinScreen.tsx',
    markers: [
      'createInitialCleanupState',
      'applyCleanupAction',
      'RecycleBinSkeleton',
      'DetailScreen',
      "BackHandler.addEventListener('hardwareBackPress'",
      'handleSelectionChange',
      'onSelectionChange={handleSelectionChange}',
      'handleRestore',
      'performDelete',
      'requestDeleteConfirmation',
      'ensureMediaLibraryDeletePermissionsAsync',
      'MediaLibrary.deleteAssetsAsync',
      'recycle-bin-grid',
      'recycle-bin-item',
      'recycle-selection-toggle-button',
      'recycle-restore-selected-button',
      'recycle-delete-selected-button',
    ],
  },
  {
    name: 'DetailScreen',
    file: 'src/ui/screens/DetailScreen.tsx',
    markers: [
      'DetailSkeleton',
      'ActionSwitch',
      'DuplicateCarousel',
      'ZoomableImage',
      'VideoPlayer',
      'buildDetailCandidates',
      'activeCandidateIdRef',
      'runActionSafely',
      'handleActiveCandidateChange',
      'detail-viewer',
      'detail-viewer-index',
      'detail-close-button',
      'detail-stage-wrap',
      'detail-action-switch',
      'detail-primary-action',
      'detail-hard-delete',
    ],
  },
];

const leafContracts = [
  {
    name: 'SelectionBar',
    file: 'src/ui/components/SelectionBar.tsx',
    markers: [
      'SELECTION_BAR_STYLE_TOKENS',
      'selection-bar',
      'selection-count',
      'select-all-button',
      'deselect-all-button',
      'clean-button',
      'onSelectAll',
      'onDeselectAll',
      'onClean',
    ],
  },
  {
    name: 'ScanCounter',
    file: 'src/ui/components/ScanCounter.tsx',
    markers: [
      'SCAN_COUNTER_STYLE_TOKENS',
      'scan-counter',
      'useScanCounter',
      'setValue',
      'increment',
      'reset',
      'cleanup',
      'getCounterText',
    ],
  },
  {
    name: 'ActionSwitch',
    file: 'src/ui/components/ActionSwitch.tsx',
    markers: [
      'ACTION_SWITCH_STYLE_TOKENS',
      'action-switch',
      'action-switch-primary',
      'action-switch-secondary',
      'selectedAction',
      'primaryTone',
      'secondaryTone',
      'TouchSurface',
    ],
  },
];

function assertMarkers({ name, file, markers }) {
  const absolutePath = resolve(root, file);
  const source = readFileSync(absolutePath, 'utf8');
  const missing = markers.filter((marker) => !source.includes(marker));

  if (missing.length > 0) {
    throw new Error(`${name} boundary contract missing markers: ${missing.join(', ')}`);
  }

  return { name, count: markers.length };
}

const checked = [...contracts, ...leafContracts].map(assertMarkers);

for (const item of checked) {
  console.log(`ok ${item.name}: ${item.count} markers`);
}

console.log('High-risk leaf boundary contracts verified.');
