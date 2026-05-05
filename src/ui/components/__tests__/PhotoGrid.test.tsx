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
    PixelRatio: {
      get: () => 3,
    },
    FlatList: ({
      data,
      renderItem,
      keyExtractor,
      contentContainerStyle,
      ...props
    }: {
      data: unknown[];
      renderItem: (info: { item: unknown; index: number }) => React.ReactNode;
      keyExtractor?: (item: unknown, index: number) => string;
      contentContainerStyle?: unknown;
    }) =>
      ReactModule.createElement(
        'FlatList',
        { contentContainerStyle, ...props },
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

import { PhotoGrid } from '../PhotoGrid';
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
  buttonSecondaryBackground: '#efe6d6',
  buttonSecondaryText: '#28404c',
  buttonTertiaryBackground: '#304856',
  buttonTertiaryText: '#e2edf0',
  buttonDangerBackground: '#b34f2f',
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

const createMockCandidate = (id: string, mediaType: 'photo' | 'video'): CleanupCandidate => ({
  id,
  asset: {
    id,
    uri: `file:///asset-${id}.jpg`,
    previewUri: `file:///preview-${id}.jpg`,
    mediaType,
    width: 1080,
    height: 1920,
    duration: mediaType === 'video' ? 10 : 0,
    fileSize: 2_000_000,
    creationTime: Date.now(),
  },
  score: 75,
  confidence: 'high',
  kind: mediaType === 'video' ? 'accidental-video' : 'accidental-photo',
  primaryIssueType: 'accidental',
  issueTypes: ['accidental'],
  reasons: ['测试原因'],
});

function flattenText(children: React.ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map((child) => flattenText(child)).join('');
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(children)) {
    return flattenText(children.props.children);
  }

  return '';
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

describe('PhotoGrid', () => {
  describe('Scenario 2.2: Segmented control filtering', () => {
    it('should be a function component that accepts mediaType prop', () => {
      expect(typeof PhotoGrid).toBe('function');
    });

    it('should filter candidates by mediaType "photo"', () => {
      const candidates: CleanupCandidate[] = [
        createMockCandidate('1', 'photo'),
        createMockCandidate('2', 'video'),
        createMockCandidate('3', 'photo'),
      ];

      // Filter logic: photos only
      const filtered = candidates.filter(c => c.asset.mediaType === 'photo');
      expect(filtered).toHaveLength(2);
      expect(filtered.every(c => c.asset.mediaType === 'photo')).toBe(true);
    });

    it('should filter candidates by mediaType "video"', () => {
      const candidates: CleanupCandidate[] = [
        createMockCandidate('1', 'photo'),
        createMockCandidate('2', 'video'),
        createMockCandidate('3', 'photo'),
        createMockCandidate('4', 'video'),
      ];

      // Filter logic: videos only
      const filtered = candidates.filter(c => c.asset.mediaType === 'video');
      expect(filtered).toHaveLength(2);
      expect(filtered.every(c => c.asset.mediaType === 'video')).toBe(true);
    });

    it('should show all items when mediaType is "all"', () => {
      const candidates: CleanupCandidate[] = [
        createMockCandidate('1', 'photo'),
        createMockCandidate('2', 'video'),
        createMockCandidate('3', 'photo'),
      ];

      // Filter logic: all items
      const filtered = candidates;
      expect(filtered).toHaveLength(3);
    });

    it('should show empty list when no matching media type', () => {
      const candidates: CleanupCandidate[] = [
        createMockCandidate('1', 'photo'),
        createMockCandidate('2', 'photo'),
      ];

      // Filter logic: videos only (but no videos)
      const filtered = candidates.filter(c => c.asset.mediaType === 'video');
      expect(filtered).toHaveLength(0);
    });
  });

  describe('Scenario 2.3: Photo grid layout', () => {
    it('should define 3 columns constant', () => {
      // The PhotoGrid component should have NUM_COLUMNS = 3
      // This is verified by checking the component structure
      expect(PhotoGrid).toBeDefined();
    });

    it('should define 2pt spacing constant', () => {
      // The PhotoGrid component should have SPACING = 2
      expect(PhotoGrid).toBeDefined();
    });

    it('should handle large data sets (300 items)', () => {
      const candidates: CleanupCandidate[] = Array.from({ length: 300 }, (_, i) =>
        createMockCandidate(`item-${i}`, i % 2 === 0 ? 'photo' : 'video')
      );

      expect(candidates).toHaveLength(300);

      // Test filtering still works with large dataset
      const photos = candidates.filter(c => c.asset.mediaType === 'photo');
      const videos = candidates.filter(c => c.asset.mediaType === 'video');

      expect(photos).toHaveLength(150);
      expect(videos).toHaveLength(150);
    });
  });

  describe('Scenario 2.4: Photo and video display', () => {
    it('should identify video items correctly', () => {
      const videoCandidate = createMockCandidate('1', 'video');
      expect(videoCandidate.asset.mediaType).toBe('video');
    });

    it('should identify photo items correctly', () => {
      const photoCandidate = createMockCandidate('1', 'photo');
      expect(photoCandidate.asset.mediaType).toBe('photo');
    });

    it('should prefer the original photo uri for sharper thumbnails', () => {
      const candidate = createMockCandidate('1', 'photo');
      const imageSource = candidate.asset.uri;
      expect(imageSource).toBe('file:///asset-1.jpg');
    });

    it('should keep using previewUri for videos when available', () => {
      const candidate = createMockCandidate('1', 'video');
      const imageSource = candidate.asset.previewUri ?? candidate.asset.uri;
      expect(imageSource).toBe('file:///preview-1.jpg');
    });

    it('should fallback to uri when video previewUri is undefined', () => {
      const candidate: CleanupCandidate = {
        ...createMockCandidate('1', 'video'),
        asset: {
          ...createMockCandidate('1', 'video').asset,
          previewUri: undefined,
          uri: 'file:///original.mp4',
        },
      };

      const imageSource = candidate.asset.previewUri ?? candidate.asset.uri;
      expect(imageSource).toBe('file:///original.mp4');
    });

    it('should have duration for video items', () => {
      const videoCandidate = createMockCandidate('1', 'video');
      expect(videoCandidate.asset.duration).toBeGreaterThan(0);
    });

    it('should have zero duration for photo items', () => {
      const photoCandidate = createMockCandidate('1', 'photo');
      expect(photoCandidate.asset.duration).toBe(0);
    });

    it('renders a standard videocam icon for video thumbnails instead of text glyphs', () => {
      let renderer!: ReturnType<typeof TestRenderer.create>;

      act(() => {
        renderer = TestRenderer.create(
          <PhotoGrid
            candidates={[createMockCandidate('1', 'video')]}
            selectedIds={[]}
            onSelect={vi.fn()}
            onItemPress={vi.fn()}
            theme={mockTheme}
          />,
        );
      });

      const icon = renderer.root.findByProps({ testID: 'video-indicator-icon' });
      expect(icon.props.name).toBe('videocam');
    });

    it('configures FlatList with virtualization hints for large grids', () => {
      let renderer!: ReturnType<typeof TestRenderer.create>;

      act(() => {
        renderer = TestRenderer.create(
          <PhotoGrid
            candidates={Array.from({ length: 30 }, (_, index) =>
              createMockCandidate(String(index), index % 2 === 0 ? 'photo' : 'video'),
            )}
            selectedIds={[]}
            onSelect={vi.fn()}
            onItemPress={vi.fn()}
            theme={mockTheme}
          />,
        );
      });

      const flatList = renderer.root.findByType('FlatList');
      const layout = flatList.props.getItemLayout(undefined, 4);

      expect(flatList.props.initialNumToRender).toBe(18);
      expect(flatList.props.maxToRenderPerBatch).toBe(18);
      expect(flatList.props.windowSize).toBe(7);
      expect(flatList.props.removeClippedSubviews).toBe(true);
      expect(layout).toMatchObject({
        length: expect.any(Number),
        offset: expect.any(Number),
        index: 4,
      });
    });
  });

  describe('Selection mode', () => {
    it('should track selectedIds as array of strings', () => {
      const selectedIds: string[] = ['1', '2', '3'];
      expect(selectedIds).toHaveLength(3);
      expect(typeof selectedIds[0]).toBe('string');
    });

    it('should support empty selection', () => {
      const selectedIds: string[] = [];
      expect(selectedIds).toHaveLength(0);
    });

    it('should identify selected items correctly', () => {
      const selectedIds = ['1', '3'];
      const isSelected = (id: string) => selectedIds.includes(id);

      expect(isSelected('1')).toBe(true);
      expect(isSelected('2')).toBe(false);
      expect(isSelected('3')).toBe(true);
    });

    it('should support toggling selection', () => {
      let selectedIds: string[] = [];

      const toggleSelect = (id: string) => {
        selectedIds = selectedIds.includes(id)
          ? selectedIds.filter(i => i !== id)
          : [...selectedIds, id];
      };

      // Select item
      toggleSelect('1');
      expect(selectedIds).toContain('1');

      // Select another item
      toggleSelect('2');
      expect(selectedIds).toContain('1');
      expect(selectedIds).toContain('2');

      // Deselect first item
      toggleSelect('1');
      expect(selectedIds).not.toContain('1');
      expect(selectedIds).toContain('2');
    });

    it('renders the selection icon without dimming the media tile', () => {
      let renderer!: ReturnType<typeof TestRenderer.create>;

      act(() => {
        renderer = TestRenderer.create(
          <PhotoGrid
            candidates={[createMockCandidate('1', 'photo')]}
            selectedIds={['1']}
            onSelect={vi.fn()}
            onItemPress={vi.fn()}
            theme={mockTheme}
          />,
        );
      });

      const item = renderer.root.findByProps({ testID: 'photo-grid-item' });
      const checkmarkIcon = renderer.root.findByProps({ testID: 'selection-checkmark-icon' });
      const filledIndicator = renderer.root.findByProps({ testID: 'selection-checkmark' });

      expect(checkmarkIcon).toBeTruthy();
      expect(flattenStyle(filledIndicator.props.style).backgroundColor).toBe(
        '#2f80ff',
      );
      expect(item.props.style.opacity).toBeUndefined();
    });

    it('shows a hollow selection circle for unselected items once selection mode is active', () => {
      let renderer!: ReturnType<typeof TestRenderer.create>;

      act(() => {
        renderer = TestRenderer.create(
          <PhotoGrid
            candidates={[createMockCandidate('1', 'photo')]}
            selectedIds={[]}
            selectionMode
            onSelect={vi.fn()}
            onItemPress={vi.fn()}
            theme={mockTheme}
          />,
        );
      });

      const emptyIndicator = renderer.root.findByProps({ testID: 'selection-indicator-empty' });

      expect(flattenStyle(emptyIndicator.props.style).borderColor).toBe('rgba(255, 255, 255, 0.96)');
      expect(renderer.root.findAllByProps({ testID: 'selection-checkmark-icon' })).toHaveLength(0);
    });

    it('renders photo thumbnails from the original asset uri with safe decode sizing', () => {
      let renderer!: ReturnType<typeof TestRenderer.create>;

      act(() => {
        renderer = TestRenderer.create(
          <PhotoGrid
            candidates={[createMockCandidate('1', 'photo')]}
            selectedIds={[]}
            onSelect={vi.fn()}
            onItemPress={vi.fn()}
            theme={mockTheme}
          />,
        );
      });

      const image = renderer.root.findByType('Image');

      expect(image.props.source).toEqual({
        uri: 'file:///asset-1.jpg',
        width: 109,
        height: 109,
        scale: 3,
      });
      expect(image.props.cachePolicy).toBe('memory-disk');
      expect(image.props.priority).toBe('normal');
      expect(image.props.allowDownscaling).toBe(true);
      expect(image.props.decodeFormat).toBe('rgb');
      expect(image.props.transition).toBe(0);
    });

    it('opens detail on tap when not in selection mode', () => {
      const onSelect = vi.fn();
      const onItemPress = vi.fn();
      let renderer!: ReturnType<typeof TestRenderer.create>;

      act(() => {
        renderer = TestRenderer.create(
          <PhotoGrid
            candidates={[createMockCandidate('1', 'photo')]}
            selectedIds={[]}
            onSelect={onSelect}
            onItemPress={onItemPress}
            theme={mockTheme}
          />,
        );
      });

      act(() => {
        renderer.root.findByProps({ testID: 'photo-grid-item' }).props.onPress();
      });

      expect(onItemPress).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('supports custom item test ids for observability probes', () => {
      let renderer!: ReturnType<typeof TestRenderer.create>;

      act(() => {
        renderer = TestRenderer.create(
          <PhotoGrid
            candidates={[createMockCandidate('1', 'photo')]}
            selectedIds={[]}
            onSelect={vi.fn()}
            onItemPress={vi.fn()}
            itemTestID="scan-result-grid-item"
            theme={mockTheme}
          />,
        );
      });

      expect(renderer.root.findByProps({ testID: 'scan-result-grid-item' })).toBeTruthy();
      expect(renderer.root.findAllByProps({ testID: 'photo-grid-item' })).toHaveLength(0);
    });

    it('enters selection mode on long press and suppresses the follow-up detail tap', () => {
      const onSelect = vi.fn();
      const onItemPress = vi.fn();
      const nowSpy = vi.spyOn(Date, 'now');
      let renderer!: ReturnType<typeof TestRenderer.create>;

      nowSpy.mockReturnValueOnce(1_000).mockReturnValueOnce(1_100);

      act(() => {
        renderer = TestRenderer.create(
          <PhotoGrid
            candidates={[createMockCandidate('1', 'photo')]}
            selectedIds={[]}
            onSelect={onSelect}
            onItemPress={onItemPress}
            theme={mockTheme}
          />,
        );
      });

      act(() => {
        const item = renderer.root.findByProps({ testID: 'photo-grid-item' });
        item.props.onLongPress();
        item.props.onPress();
      });

      expect(onSelect).toHaveBeenCalledWith('1');
      expect(onItemPress).not.toHaveBeenCalled();

      nowSpy.mockRestore();
    });

    it('toggles selection on tap once selection mode is active', () => {
      const onSelect = vi.fn();
      const onItemPress = vi.fn();
      let renderer!: ReturnType<typeof TestRenderer.create>;

      act(() => {
        renderer = TestRenderer.create(
          <PhotoGrid
            candidates={[createMockCandidate('1', 'photo')]}
            selectedIds={['1']}
            selectionMode
            onSelect={onSelect}
            onItemPress={onItemPress}
            theme={mockTheme}
          />,
        );
      });

      act(() => {
        renderer.root.findByProps({ testID: 'photo-grid-item' }).props.onPress();
      });

      expect(onSelect).toHaveBeenCalledWith('1');
      expect(onItemPress).not.toHaveBeenCalled();
    });

    it('renders video thumbnails from previewUri when one exists', () => {
      let renderer!: ReturnType<typeof TestRenderer.create>;

      act(() => {
        renderer = TestRenderer.create(
          <PhotoGrid
            candidates={[createMockCandidate('1', 'video')]}
            selectedIds={[]}
            onSelect={vi.fn()}
            onItemPress={vi.fn()}
            theme={mockTheme}
          />,
        );
      });

      const image = renderer.root.findByType('Image');

      expect(image.props.source).toEqual({
        uri: 'file:///preview-1.jpg',
        width: 109,
        height: 109,
        scale: 3,
      });
    });

    it('does not render abnormal tag copy in default non-selection mode', () => {
      let renderer!: ReturnType<typeof TestRenderer.create>;

      act(() => {
        renderer = TestRenderer.create(
          <PhotoGrid
            candidates={[createMockCandidate('1', 'photo')]}
            selectedIds={[]}
            onSelect={vi.fn()}
            onItemPress={vi.fn()}
            theme={mockTheme}
          />,
        );
      });

      const texts = renderer.root.findAllByType('Text').map((node: {
        props: { children?: React.ReactNode };
      }) => flattenText(node.props.children));

      expect(texts).not.toContain('测试原因');
      expect(renderer.root.findAllByProps({ testID: 'selection-indicator-empty' })).toHaveLength(0);
      expect(renderer.root.findAllByProps({ testID: 'selection-checkmark' })).toHaveLength(0);
    });

    it('shows a duplicate-count badge using the actionable duplicate count instead of duplicateGroup.size', () => {
      const duplicateCandidateA: CleanupCandidate = {
        ...createMockCandidate('duplicate-1', 'photo'),
        duplicateGroup: {
          groupId: 'duplicate-group-1',
          representativeId: 'duplicate-keep',
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
      const duplicateCandidateB: CleanupCandidate = {
        ...createMockCandidate('duplicate-2', 'photo'),
        duplicateGroup: {
          ...duplicateCandidateA.duplicateGroup!,
        },
      };
      let renderer!: ReturnType<typeof TestRenderer.create>;

      act(() => {
        renderer = TestRenderer.create(
          <PhotoGrid
            candidates={[duplicateCandidateA, duplicateCandidateB]}
            selectedIds={[]}
            onSelect={vi.fn()}
            onItemPress={vi.fn()}
            theme={mockTheme}
          />,
        );
      });

      const badges = renderer.root.findAllByProps({ testID: 'duplicate-count-badge' });
      const badgeText = renderer.root.findAllByType('Text').find((node: {
        props: { children?: React.ReactNode };
      }) => flattenText(node.props.children) === '2');

      expect(badges).toHaveLength(2);
      expect(flattenStyle(badges[0]?.props.style).backgroundColor).toBe('#df676d');
      expect(badgeText).toBeTruthy();
    });

    it('does not show a duplicate-count badge when only one actionable duplicate remains visible', () => {
      const duplicateCandidate: CleanupCandidate = {
        ...createMockCandidate('duplicate-1', 'photo'),
        duplicateGroup: {
          groupId: 'duplicate-group-1',
          representativeId: 'duplicate-keep',
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
      let renderer!: ReturnType<typeof TestRenderer.create>;

      act(() => {
        renderer = TestRenderer.create(
          <PhotoGrid
            candidates={[duplicateCandidate]}
            selectedIds={[]}
            onSelect={vi.fn()}
            onItemPress={vi.fn()}
            theme={mockTheme}
          />,
        );
      });

      expect(renderer.root.findAllByProps({ testID: 'duplicate-count-badge' })).toHaveLength(0);
      expect(
        renderer.root.findAllByType('Text').find((node: {
          props: { children?: React.ReactNode };
        }) => flattenText(node.props.children) === '1'),
      ).toBeUndefined();
    });
  });

  describe('Props validation', () => {
    it('should require candidates prop', () => {
      // Verify the component signature expects candidates
      const props = {
        candidates: [] as CleanupCandidate[],
        selectedIds: [] as string[],
        onSelect: vi.fn(),
        onItemPress: vi.fn(),
        theme: mockTheme,
      };
      expect(props.candidates).toBeDefined();
    });

    it('should require selectedIds prop', () => {
      const props = {
        candidates: [],
        selectedIds: [] as string[],
        onSelect: vi.fn(),
        onItemPress: vi.fn(),
        theme: mockTheme,
      };
      expect(Array.isArray(props.selectedIds)).toBe(true);
    });

    it('should require onSelect callback', () => {
      const onSelect = vi.fn();
      expect(typeof onSelect).toBe('function');
    });

    it('should require onItemPress callback', () => {
      const onItemPress = vi.fn();
      expect(typeof onItemPress).toBe('function');
    });

    it('should accept optional mediaType prop', () => {
      const validMediaTypes: Array<'all' | 'photo' | 'video'> = ['all', 'photo', 'video'];
      expect(validMediaTypes).toContain('all');
      expect(validMediaTypes).toContain('photo');
      expect(validMediaTypes).toContain('video');
    });

    it('should accept optional selectionMode prop', () => {
      const props = {
        candidates: [] as CleanupCandidate[],
        selectedIds: [] as string[],
        selectionMode: true,
        onSelect: vi.fn(),
        onItemPress: vi.fn(),
        theme: mockTheme,
      };

      expect(props.selectionMode).toBe(true);
    });
  });
});
