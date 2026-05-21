import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native';

import type { CleanupCandidate } from '../../domain/recognition/types';
import type { AppLanguage } from '../../i18n/app-language';
import type { AppThemePalette } from '../../theme/app-theme';
import { COMPONENT_TOKENS } from '../../theme/generated/component-tokens.generated';
import { AppIcon } from '../icons/AppIcon';
import { IconButton } from '../primitives';
import { VideoPlayer } from './VideoPlayer';
import { ZoomableImage } from './ZoomableImage';

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
  orientation?: number | null;
  duration: number;
}

interface WindowedViewerItem extends ViewerItem {
  index: number;
  reuseSlot: number;
}

export const DUPLICATE_CAROUSEL_STYLE_TOKENS = COMPONENT_TOKENS.duplicateCarousel;

const DEFAULT_STAGE_WIDTH = Math.max(
  Dimensions.get('window').width,
  DUPLICATE_CAROUSEL_STYLE_TOKENS.defaultStage.minWidth,
);
const DEFAULT_STAGE_HEIGHT = Math.max(
  Math.round(DEFAULT_STAGE_WIDTH * DUPLICATE_CAROUSEL_STYLE_TOKENS.defaultStage.heightRatio),
  DUPLICATE_CAROUSEL_STYLE_TOKENS.defaultStage.minHeight,
);
const WINDOWED_VIEW_REUSE_SLOT_COUNT = DUPLICATE_CAROUSEL_STYLE_TOKENS.windowing.reuseSlotCount;
const ACTIVE_ZOOM_LOCK_SCALE = 1.01;

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
      orientation: entry.asset.orientation,
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
  const [activeScale, setActiveScale] = useState(1);

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

  useEffect(() => {
    setActiveScale(1);
  }, [resolvedActiveId]);

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

  const isActiveItemZoomed = activeScale > ACTIVE_ZOOM_LOCK_SCALE;

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
          snapToInterval={stageSize.width}
          snapToAlignment="center"
          disableIntervalMomentum
          showsHorizontalScrollIndicator={false}
          removeClippedSubviews
          bounces={false}
          overScrollMode="never"
          scrollEnabled={viewerItems.length > 1 && !isActiveItemZoomed}
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
            <CarouselSlide
              key={`${item.mediaType}-${item.reuseSlot}`}
              item={item}
              stageSize={stageSize}
              theme={theme}
              isActive={item.id === resolvedActiveId}
              onScaleChange={item.id === resolvedActiveId ? setActiveScale : undefined}
              panEnabled={item.id === resolvedActiveId && isActiveItemZoomed}
            />
          ))}
        </ScrollView>

        {viewerItems.length > 1 ? (
          <>
            {currentIndex > 0 ? (
              <IconButton
                onPress={handlePrev}
                size={DUPLICATE_CAROUSEL_STYLE_TOKENS.nav.buttonSize}
                theme={theme}
                variant="overlay"
                style={[styles.navButton, styles.navButtonLeft]}
                pressedStyle={styles.navButtonPressed}
                testID="duplicate-nav-prev"
              >
                <AppIcon
                  name="chevron-back"
                  size={DUPLICATE_CAROUSEL_STYLE_TOKENS.nav.iconSize}
                  color={theme.buttonPrimaryText}
                />
              </IconButton>
            ) : null}
            {currentIndex < viewerItems.length - 1 ? (
              <IconButton
                onPress={handleNext}
                size={DUPLICATE_CAROUSEL_STYLE_TOKENS.nav.buttonSize}
                theme={theme}
                variant="overlay"
                style={[styles.navButton, styles.navButtonRight]}
                pressedStyle={styles.navButtonPressed}
                testID="duplicate-nav-next"
              >
                <AppIcon
                  name="chevron-forward"
                  size={DUPLICATE_CAROUSEL_STYLE_TOKENS.nav.iconSize}
                  color={theme.buttonPrimaryText}
                />
              </IconButton>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

function CarouselSlide({
  item,
  stageSize,
  theme,
  isActive,
  onScaleChange,
  panEnabled,
}: {
  item: WindowedViewerItem;
  stageSize: { width: number; height: number };
  theme: AppThemePalette;
  isActive: boolean;
  onScaleChange?: (scale: number) => void;
  panEnabled: boolean;
}) {
  return (
    <View
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
            isActive={isActive}
          />
        </View>
      ) : (
        <View style={styles.media} testID={`duplicate-stage-media-${item.id}`}>
          <ZoomableImage
            key={item.id}
            uri={item.uri}
            width={stageSize.width}
            height={stageSize.height}
            orientation={item.orientation}
            maxScale={3}
            minScale={1}
            onScaleChange={onScaleChange}
            panEnabled={panEnabled}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
      width: DUPLICATE_CAROUSEL_STYLE_TOKENS.nav.buttonSize,
      height: DUPLICATE_CAROUSEL_STYLE_TOKENS.nav.buttonSize,
      marginTop: -DUPLICATE_CAROUSEL_STYLE_TOKENS.nav.buttonSize / 2,
      borderRadius: DUPLICATE_CAROUSEL_STYLE_TOKENS.nav.buttonSize / 2,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: DUPLICATE_CAROUSEL_STYLE_TOKENS.nav.background,
    },
    navButtonPressed: {
      backgroundColor: DUPLICATE_CAROUSEL_STYLE_TOKENS.nav.pressedBackground,
    },
    navButtonLeft: {
      left: DUPLICATE_CAROUSEL_STYLE_TOKENS.nav.buttonInset,
    },
    navButtonRight: {
      right: DUPLICATE_CAROUSEL_STYLE_TOKENS.nav.buttonInset,
    },
});
