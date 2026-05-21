import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

vi.mock('react-native', () => {
  const ReactModule = require('react') as typeof import('react');

  return {
    View: 'View',
    Text: 'Text',
    Pressable: 'Pressable',
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
      hairlineWidth: 1,
    },
    Dimensions: {
      get: () => ({ width: 375, height: 812 }),
    },
    useWindowDimensions: () => ({ width: 375, height: 812, scale: 3, fontScale: 1 }),
    PixelRatio: {
      get: () => 3,
    },
    FlatList: ({
      data,
      renderItem,
      keyExtractor,
    }: {
      data: unknown[];
      renderItem: (info: { item: unknown; index: number }) => React.ReactNode;
      keyExtractor?: (item: unknown, index: number) => string;
    }) =>
      ReactModule.createElement(
        'FlatList',
        null,
        ...(data ?? []).map((item, index) =>
          ReactModule.createElement(
            ReactModule.Fragment,
            { key: keyExtractor ? keyExtractor(item, index) : String(index) },
            renderItem({ item, index }),
          ),
        ),
      ),
  };
});

vi.mock('expo-image', () => ({
  Image: 'Image',
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({
    name,
    color,
    size,
    testID,
  }: {
    name: string;
    color: string;
    size: number;
    testID?: string;
  }) => React.createElement('Ionicons', { name, color, size, testID }),
}));

import { PhotoGrid, PHOTO_GRID_STYLE_TOKENS } from '../PhotoGrid';
import type { CleanupCandidate } from '../../../domain/recognition/types';
import type { AppThemePalette } from '../../../theme/app-theme';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockTheme: AppThemePalette = {
  scheme: 'light',
  statusBarStyle: 'dark',
  safeArea: '#f3ecdf',
  orbTop: '#d8e7df',
  orbBottom: '#f2d4c6',
  heroBackground: '#173944',
  heroSurface: '#102a33',
  heroAccent: '#9ed3c7',
  heroTitle: '#fff7ec',
  heroText: '#dce6e5',
  heroHint: '#bfcdcf',
  pageTextPrimary: '#18212f',
  pageTextSecondary: '#546272',
  pageTextMuted: '#7c8595',
  cardBackground: '#fffaf1',
  cardBorder: '#e7dcc7',
  cardMutedBackground: '#f6f7fb',
  cardMutedBorder: '#d8dce8',
  infoBackground: '#eef3f5',
  infoBorder: '#d8e2e6',
  noticeBackground: '#fff1e8',
  noticeBorder: '#efc9b4',
  noticeTitle: '#7d3f22',
  noticeText: '#965a3a',
  inputBackground: '#f8f4ea',
  inputBorder: '#d9cfbe',
  inputText: '#18212f',
  buttonPrimaryBackground: '#173944',
  buttonPrimaryText: '#ffffff',
  buttonSuccessBackground: '#18bf63',
  buttonSuccessPressedBackground: '#15ad59',
  buttonSecondaryBackground: '#efe6d6',
  buttonSecondaryText: '#28404c',
  buttonTertiaryBackground: '#304856',
  buttonTertiaryText: '#e2edf0',
  buttonDangerBackground: '#b34f2f',
  buttonDangerPressedBackground: '#c65a60',
  buttonDangerText: '#ffffff',
  chipBackground: '#efe6d6',
  chipBorder: '#e1d5c2',
  chipText: '#304856',
  chipActiveBackground: '#173944',
  chipActiveText: '#ffffff',
  tabBackground: '#e9e1d2',
  tabText: '#596171',
  tabActiveBackground: '#173944',
  tabActiveText: '#ffffff',
  actionBarBackground: '#142a33',
  actionBarText: '#fff7ec',
  shadowColor: '#0f172a',
  thumbnailBackground: '#d8d2c5',
  previewBackground: '#141c28',
};

function createCandidate(id: string): CleanupCandidate {
  return {
    id,
    asset: {
      id,
      uri: `file:///${id}.jpg`,
      previewUri: `file:///preview-${id}.jpg`,
      mediaType: 'photo',
      width: 1080,
      height: 1440,
      duration: 0,
      fileSize: 1_600_000,
      creationTime: Date.now(),
    },
    score: 82,
    confidence: 'high',
    kind: 'duplicate-photo',
    primaryIssueType: 'duplicate',
    issueTypes: ['duplicate'],
    reasons: ['与其他媒体高度相似'],
    duplicateGroup: {
      groupId: 'dup-group',
      representativeId: 'keep-best',
      relation: 'exact',
      size: 3,
      similarity: 0.98,
      representativeReason: 'higher-resolution',
      representativeWidth: 3024,
      representativeHeight: 4032,
      representativeFileSize: 4_200_000,
      representativeCreationTime: Date.now(),
    },
  };
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, entry) => ({ ...acc, ...flattenStyle(entry) }),
      {},
    );
  }

  if (style && typeof style === 'object') {
    return style as Record<string, unknown>;
  }

  return {};
}

describe('PhotoGridItem selection visuals', () => {
  it('renders a hollow picker circle after long-press style selection mode activates', () => {
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <PhotoGrid
          candidates={[createCandidate('item-1')]}
          selectedIds={[]}
          selectionMode
          onSelect={vi.fn()}
          onItemPress={vi.fn()}
          theme={mockTheme}
        />,
      );
    });

    const emptyIndicator = renderer.root.findByProps({ testID: 'selection-indicator-empty' });

    expect(flattenStyle(emptyIndicator.props.style)).toMatchObject({
      width: PHOTO_GRID_STYLE_TOKENS.selection.sizeCompact,
      height: PHOTO_GRID_STYLE_TOKENS.selection.sizeCompact,
      top: PHOTO_GRID_STYLE_TOKENS.selection.offsetCompact,
      right: PHOTO_GRID_STYLE_TOKENS.selection.offsetCompact,
      backgroundColor: PHOTO_GRID_STYLE_TOKENS.selection.emptyBackgroundCompact,
      borderColor: PHOTO_GRID_STYLE_TOKENS.selection.borderColorCompact,
    });
  });

  it('renders a filled primary circle with checkmark after the item is selected', () => {
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <PhotoGrid
          candidates={[createCandidate('item-1')]}
          selectedIds={['item-1']}
          selectionMode
          onSelect={vi.fn()}
          onItemPress={vi.fn()}
          theme={mockTheme}
        />,
      );
    });

    const filledIndicator = renderer.root.findByProps({ testID: 'selection-checkmark' });
    const checkmarkIcon = renderer.root.findByProps({ testID: 'selection-checkmark-icon' });

    expect(flattenStyle(filledIndicator.props.style)).toMatchObject({
      width: PHOTO_GRID_STYLE_TOKENS.selection.sizeCompact,
      height: PHOTO_GRID_STYLE_TOKENS.selection.sizeCompact,
      top: PHOTO_GRID_STYLE_TOKENS.selection.offsetCompact,
      right: PHOTO_GRID_STYLE_TOKENS.selection.offsetCompact,
      backgroundColor: PHOTO_GRID_STYLE_TOKENS.selection.filledBackground,
      borderColor: PHOTO_GRID_STYLE_TOKENS.selection.borderColorCompact,
    });
    expect(checkmarkIcon.props.name).toBe('checkmark');
    expect(checkmarkIcon.props.color).toBe(PHOTO_GRID_STYLE_TOKENS.selection.foreground);
  });
});
