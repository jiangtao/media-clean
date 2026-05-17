import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';

import type { CleanupCandidate } from '../../domain/recognition/types';
import type { AppLanguage } from '../../i18n/app-language';
import type { AppThemePalette } from '../../theme/app-theme';
import { AppIcon } from '../icons/AppIcon';
import { buildSizedImageSource } from './image-source';
import { TouchSurface } from './TouchSurface';
import { VideoPlayer } from './VideoPlayer';

interface DuplicateCarouselProps {
  candidate: CleanupCandidate;
  duplicateCandidates?: CleanupCandidate[];
  language: AppLanguage;
  theme: AppThemePalette;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  expanded?: boolean;
  activeId?: string;
  onActiveIdChange?: (photoId: string) => void;
  showSelectionList?: boolean;
  onFocusedPhotoChange?: (photoId: string, isRepresentative: boolean) => void;
}

interface ViewerItem {
  id: string;
  uri: string;
  mediaType: CleanupCandidate['asset']['mediaType'];
  width: number;
  height: number;
  duration: number;
}

interface WindowedViewerItem extends ViewerItem {
  index: number;
  reuseSlot: number;
}

const DEFAULT_STAGE_WIDTH = Math.max(Dimensions.get('window').width - 32, 280);
const DEFAULT_STAGE_HEIGHT = Math.max(Math.round(DEFAULT_STAGE_WIDTH * 1.45), 320);
const WINDOWED_VIEW_REUSE_SLOT_COUNT = 3;

function buildViewerItems(
  candidate: CleanupCandidate,
  duplicateCandidates: CleanupCandidate[] | undefined,
): ViewerItem[] {
  const orderedEntries = duplicateCandidates?.length ? [...duplicateCandidates] : [candidate];

  if (!orderedEntries.some((entry) => entry.id === candidate.id)) {
    orderedEntries.unshift(candidate);
  }

  return Array.from(new Map(orderedEntries.map((entry) => [entry.id, entry])).values()).map(
    (entry) => ({
      id: entry.id,
      uri: entry.asset.uri,
      mediaType: entry.asset.mediaType,
      width: entry.asset.width,
      height: entry.asset.height,
      duration: entry.asset.duration,
    }),
  );
}

function buildWindowedViewerItems(viewerItems: ViewerItem[], currentIndex: number): WindowedViewerItem[] {
  const startIndex = Math.max(0, currentIndex - 1);
  const endIndex = Math.min(viewerItems.length - 1, currentIndex + 1);
  const items: WindowedViewerItem[] = [];

  for (let index = startIndex; index <= endIndex; index += 1) {
    const item = viewerItems[index];
    if (!item) {
      continue;
    }

    items.push({
      ...item,
      index,
      reuseSlot: index % WINDOWED_VIEW_REUSE_SLOT_COUNT,
    });
  }

  return items;
}

export function DuplicateCarousel({
  candidate,
  duplicateCandidates,
  theme,
  activeId,
  onActiveIdChange,
  onFocusedPhotoChange,
}: DuplicateCarouselProps) {
  const styles = useMemo(() => createStyles(), []);
  const viewerItems = useMemo(
    () => buildViewerItems(candidate, duplicateCandidates),
    [candidate, duplicateCandidates],
  );
  const [internalActiveId, setInternalActiveId] = useState<string | null>(candidate.id);
  const [stageSize, setStageSize] = useState({
    width: DEFAULT_STAGE_WIDTH,
    height: DEFAULT_STAGE_HEIGHT,
  });
  const scrollRef = useRef<ScrollView | null>(null);
  const syncedScrollPositionRef = useRef<{ index: number; width: number } | null>(null);

  useEffect(() => {
    if (activeId !== undefined) {
      return;
    }

    const defaultActiveId =
      viewerItems.find((item) => item.id === candidate.id)?.id ?? viewerItems[0]?.id ?? null;

    setInternalActiveId((current) => (current === defaultActiveId ? current : defaultActiveId));
  }, [activeId, candidate.id, viewerItems]);

  const resolvedActiveId = activeId ?? internalActiveId ?? viewerItems[0]?.id ?? null;
  const currentIndex = Math.max(
    0,
    viewerItems.findIndex((item) => item.id === resolvedActiveId),
  );
  const windowedViewerItems = useMemo(
    () => buildWindowedViewerItems(viewerItems, currentIndex),
    [currentIndex, viewerItems],
  );

  useEffect(() => {
    if (!resolvedActiveId) {
      return;
    }

    const focusedIndex = viewerItems.findIndex((item) => item.id === resolvedActiveId);
    if (focusedIndex < 0) {
      return;
    }

    const syncedScrollPosition = syncedScrollPositionRef.current;
    if (
      syncedScrollPosition?.index === focusedIndex &&
      syncedScrollPosition.width === stageSize.width
    ) {
      return;
    }

    syncedScrollPositionRef.current = {
      index: focusedIndex,
      width: stageSize.width,
    };
    scrollRef.current?.scrollTo?.({
      x: focusedIndex * stageSize.width,
      animated: false,
    });
  }, [resolvedActiveId, stageSize.width, viewerItems]);

  const syncFocusedItem = (nextIndex: number) => {
    const nextItem = viewerItems[nextIndex];
    if (!nextItem) {
      return;
    }

    if (activeId === undefined) {
      setInternalActiveId(nextItem.id);
    }
    onActiveIdChange?.(nextItem.id);
    onFocusedPhotoChange?.(nextItem.id, false);
  };

  const handleStageMomentumEnd = (offsetX: number, width: number) => {
    if (width <= 0) {
      return;
    }

    const nextIndex = Math.max(0, Math.min(viewerItems.length - 1, Math.round(offsetX / width)));
    syncedScrollPositionRef.current = {
      index: nextIndex,
      width,
    };

    if (nextIndex === currentIndex) {
      return;
    }

    syncFocusedItem(nextIndex);
  };

  const scrollToIndex = (nextIndex: number) => {
    if (nextIndex === currentIndex) {
      return;
    }

    syncedScrollPositionRef.current = {
      index: nextIndex,
      width: stageSize.width,
    };
    syncFocusedItem(nextIndex);
    scrollRef.current?.scrollTo?.({
      x: nextIndex * stageSize.width,
      animated: true,
    });
  };

  const handlePrev = () => {
    if (currentIndex <= 0) {
      return;
    }

    scrollToIndex(currentIndex - 1);
  };

  const handleNext = () => {
    if (currentIndex >= viewerItems.length - 1) {
      return;
    }

    scrollToIndex(currentIndex + 1);
  };

  if (viewerItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} testID="detail-duplicate-carousel">
      <View
        style={styles.stage}
        testID="duplicate-stage"
        onLayout={(event) => {
          const nextStageSize = {
            width: event.nativeEvent.layout.width || DEFAULT_STAGE_WIDTH,
            height: event.nativeEvent.layout.height || DEFAULT_STAGE_HEIGHT,
          };

          setStageSize((currentStageSize) =>
            currentStageSize.width === nextStageSize.width &&
            currentStageSize.height === nextStageSize.height
              ? currentStageSize
              : nextStageSize,
          );
        }}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.stageScroll}
          contentContainerStyle={[
            styles.stageScrollContent,
            {
              width: stageSize.width * viewerItems.length,
              height: stageSize.height,
            },
          ]}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          removeClippedSubviews
          scrollEnabled={viewerItems.length > 1}
          decelerationRate="fast"
          onMomentumScrollEnd={(event) =>
            handleStageMomentumEnd(
              event.nativeEvent.contentOffset.x,
              event.nativeEvent.layoutMeasurement.width,
            )
          }
          testID="duplicate-stage-scroll"
        >
          {windowedViewerItems.map((item) => (
            <View
              key={`${item.mediaType}-${item.reuseSlot}`}
              style={[styles.slide, { width: stageSize.width, left: item.index * stageSize.width }]}
              testID={`duplicate-stage-slide-${item.id}`}
            >
              {item.mediaType === 'video' ? (
                <View style={styles.videoWrap} testID={`duplicate-stage-video-${item.id}`}>
                  <VideoPlayer
                    uri={item.uri}
                    width={item.width}
                    height={item.height}
                    theme={theme}
                    isActive={item.id === resolvedActiveId}
                  />
                </View>
              ) : (
                <Image
                  source={buildSizedImageSource(item.uri, stageSize.width, stageSize.height)}
                  style={styles.media}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  priority="high"
                  allowDownscaling
                  transition={0}
                  recyclingKey={item.uri}
                  testID={`duplicate-stage-media-${item.id}`}
                />
              )}
            </View>
          ))}
        </ScrollView>

        {viewerItems.length > 1 ? (
          <>
            {currentIndex > 0 ? (
              <TouchSurface
                onPress={handlePrev}
                style={[styles.navButton, styles.navButtonLeft]}
                pressedStyle={styles.navButtonPressed}
                preset="icon"
                testID="duplicate-nav-prev"
              >
                <AppIcon name="chevron-back" size={18} color="#ffffff" />
              </TouchSurface>
            ) : null}
            {currentIndex < viewerItems.length - 1 ? (
              <TouchSurface
                onPress={handleNext}
                style={[styles.navButton, styles.navButtonRight]}
                pressedStyle={styles.navButtonPressed}
                preset="icon"
                testID="duplicate-nav-next"
              >
                <AppIcon name="chevron-forward" size={18} color="#ffffff" />
              </TouchSurface>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    container: {
      flex: 1,
      width: '100%',
    },
    stage: {
      flex: 1,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    stageScroll: {
      width: '100%',
      height: '100%',
    },
    stageScrollContent: {
      position: 'relative',
    },
    slide: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    media: {
      width: '100%',
      height: '100%',
    },
    videoWrap: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    navButton: {
      position: 'absolute',
      top: '50%',
      marginTop: -23,
      width: 46,
      height: 46,
      borderRadius: 23,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(14, 30, 38, 0.76)',
    },
    navButtonPressed: {
      backgroundColor: 'rgba(14, 30, 38, 0.92)',
    },
    navButtonLeft: {
      left: 12,
    },
    navButtonRight: {
      right: 12,
    },
  });
}
