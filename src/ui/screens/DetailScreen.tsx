import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CleanupCandidate } from '../../domain/recognition/types';
import type { AppLanguage } from '../../i18n/app-language';
import { getAppCopy, getDetailViewerTags } from '../../i18n/app-copy';
import type { AppThemePalette } from '../../theme/app-theme';
import { ActionSwitch } from '../components/ActionSwitch';
import { DuplicateCarousel } from '../components/DuplicateCarousel';
import { buildSizedImageSource } from '../components/image-source';
import { TouchSurface } from '../components/TouchSurface';
import { VideoPlayer } from '../components/VideoPlayer';
import { ZoomableImage } from '../components/ZoomableImage';

interface DetailScreenProps {
  candidate: CleanupCandidate | null;
  browseCandidates?: CleanupCandidate[];
  duplicateCandidates?: CleanupCandidate[];
  language: AppLanguage;
  theme: AppThemePalette;
  mode: 'suggestions' | 'recycle';
  onClose: () => void;
  onPrimaryAction: (ids?: string[]) => void | Promise<void>;
  onHardDelete: (ids?: string[]) => void | Promise<void>;
  onKeep?: (ids?: string[]) => void | Promise<void>;
}

function buildDetailCandidates(
  candidate: CleanupCandidate,
  duplicateCandidates: CleanupCandidate[] | undefined,
) {
  if (!candidate.duplicateGroup) {
    return [candidate];
  }

  const entries = duplicateCandidates?.length ? [...duplicateCandidates] : [candidate];

  if (!entries.some((entry) => entry.id === candidate.id)) {
    entries.unshift(candidate);
  }

  return Array.from(new Map(entries.map((entry) => [entry.id, entry])).values());
}

function resolveTagTone(label: string) {
  const normalizedLabel = label.toLowerCase();

  if (
    normalizedLabel.includes('重复') ||
    normalizedLabel.includes('exact') ||
    normalizedLabel.includes('duplicate')
  ) {
    return 'danger' as const;
  }

  if (
    normalizedLabel.includes('相似') ||
    normalizedLabel.includes('similar') ||
    normalizedLabel.includes('%') ||
    normalizedLabel.includes('低质量') ||
    normalizedLabel.includes('模糊') ||
    normalizedLabel.includes('过暗') ||
    normalizedLabel.includes('曝光') ||
    normalizedLabel.includes('dark') ||
    normalizedLabel.includes('blur') ||
    normalizedLabel.includes('quality')
  ) {
    return 'warning' as const;
  }

  return 'neutral' as const;
}

function selectDetailViewerTags(candidate: CleanupCandidate, tags: string[]) {
  if (tags.length <= 3) {
    return tags;
  }

  const pinnedCount = candidate.duplicateGroup ? Math.min(2, tags.length) : 0;
  const pinnedTags = tags.slice(0, pinnedCount);
  const trailingTags = tags.slice(-(3 - pinnedTags.length));

  return Array.from(new Set([...pinnedTags, ...trailingTags])).slice(0, 3);
}

function resolveDetailActionSelection(
  candidate: CleanupCandidate,
  mode: DetailScreenProps['mode'],
  showKeepAction: boolean,
) {
  if (mode !== 'suggestions' || !showKeepAction) {
    return null;
  }

  if (candidate.duplicateGroup) {
    const isRepresentativeCandidate =
      candidate.id === candidate.duplicateGroup.representativeId ||
      (candidate.asset.width >= candidate.duplicateGroup.representativeWidth &&
        candidate.asset.height >= candidate.duplicateGroup.representativeHeight &&
        candidate.asset.fileSize >= candidate.duplicateGroup.representativeFileSize &&
        candidate.asset.creationTime >= candidate.duplicateGroup.representativeCreationTime);

    return isRepresentativeCandidate ? 'primary' : 'secondary';
  }

  if (candidate.score >= 80 && candidate.confidence === 'high') {
    return 'secondary';
  }

  return 'primary';
}

export function DetailScreen({
  candidate,
  duplicateCandidates,
  language,
  theme,
  mode,
  onClose,
  onPrimaryAction,
  onHardDelete,
  onKeep,
}: DetailScreenProps) {
  const copy = getAppCopy(language);
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(insets), [insets]);
  const window = Dimensions.get('window');
  const defaultStageWidth = Math.max(window.width - insets.left - insets.right, 280);
  const defaultStageHeight = Math.max(
    window.height - Math.max(insets.top, 16) - Math.max(insets.bottom, 18) - 132,
    320,
  );
  const detailCandidates = useMemo(
    () => (candidate ? buildDetailCandidates(candidate, duplicateCandidates) : []),
    [candidate, duplicateCandidates],
  );
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(candidate?.id ?? null);
  const [stageSize, setStageSize] = useState({
    width: defaultStageWidth,
    height: defaultStageHeight,
  });
  const activeCandidateIdRef = useRef<string | null>(candidate?.id ?? null);

  useEffect(() => {
    if (!candidate) {
      activeCandidateIdRef.current = null;
      setActiveCandidateId(null);
      return;
    }

    activeCandidateIdRef.current = candidate.id;
    setActiveCandidateId(candidate.id);
  }, [candidate?.id]);

  if (!candidate) {
    return null;
  }

  const viewerCandidates = detailCandidates.length > 0 ? detailCandidates : [candidate];
  const activeDetailCandidate =
    viewerCandidates.find((entry) => entry.id === activeCandidateId) ?? candidate;
  const activeCandidateIndex = Math.max(
    0,
    viewerCandidates.findIndex((entry) => entry.id === activeDetailCandidate.id),
  );
  const actionTargetIds = [activeCandidateIdRef.current ?? activeDetailCandidate.id];
  const showKeepAction = mode === 'suggestions' && Boolean(onKeep);
  const primaryLabel =
    mode === 'recycle'
      ? copy.preview.keepCompactAction
      : showKeepAction
        ? copy.preview.keepCompactAction
        : copy.preview.clearCompactAction;
  const secondaryLabel =
    mode === 'recycle'
      ? copy.preview.deleteForeverCompactAction
      : showKeepAction
        ? copy.preview.clearCompactAction
        : copy.preview.deleteForeverCompactAction;
  const viewerTags = selectDetailViewerTags(
    activeDetailCandidate,
    getDetailViewerTags(activeDetailCandidate, language),
  );
  const selectedAction = resolveDetailActionSelection(activeDetailCandidate, mode, showKeepAction);

  const runActionSafely = (action: () => void | Promise<void>) => {
    try {
      void Promise.resolve(action()).catch((error) => {
        console.error('Detail action failed:', error);
      });
    } catch (error) {
      console.error('Detail action failed:', error);
    }
  };

  const handleActiveCandidateChange = (nextId: string) => {
    activeCandidateIdRef.current = nextId;
    setActiveCandidateId(nextId);
  };

  const handlePrimaryActionPress = () => {
    if (showKeepAction) {
      runActionSafely(() => onKeep?.(actionTargetIds));
      return;
    }

    runActionSafely(() => onPrimaryAction(actionTargetIds));
  };

  const handleSecondaryActionPress = () => {
    if (showKeepAction) {
      runActionSafely(() => onPrimaryAction(actionTargetIds));
      return;
    }

    runActionSafely(() => onHardDelete(actionTargetIds));
  };

  return (
    <View style={styles.container} testID="detail-viewer">
      <View style={styles.header}>
        <Text style={styles.indexText} testID="detail-viewer-index">
          {activeCandidateIndex + 1} / {viewerCandidates.length}
        </Text>
        <TouchSurface
          onPress={onClose}
          style={styles.closeButton}
          pressedStyle={styles.closeButtonPressed}
          preset="icon"
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          testID="detail-close-button"
        >
          <Ionicons name="close" size={16} color="#ffffff" />
        </TouchSurface>
      </View>

      <View
        style={styles.stageWrap}
        testID="detail-stage-wrap"
        onLayout={(event) =>
          setStageSize({
            width: event.nativeEvent.layout.width || defaultStageWidth,
            height: event.nativeEvent.layout.height || defaultStageHeight,
          })
        }
      >
        {viewerCandidates.length > 1 ? (
          <DuplicateCarousel
            candidate={activeDetailCandidate}
            duplicateCandidates={viewerCandidates}
            language={language}
            theme={theme}
            selectedIds={[]}
            onSelectionChange={() => undefined}
            activeId={activeDetailCandidate.id}
            onActiveIdChange={handleActiveCandidateChange}
          />
        ) : activeDetailCandidate.asset.mediaType === 'video' ? (
          <View style={styles.singleStage} testID="detail-photo-preview">
            <VideoPlayer
              uri={activeDetailCandidate.asset.uri}
              width={activeDetailCandidate.asset.width}
              height={activeDetailCandidate.asset.height}
              theme={theme}
            />
          </View>
        ) : (
          <View style={styles.singleStage} testID="detail-photo-preview">
            <ZoomableImage
              uri={activeDetailCandidate.asset.uri}
              width={stageSize.width}
              height={stageSize.height}
              maxScale={3}
              minScale={1}
              doubleTapReset
            />
          </View>
        )}
        <View style={styles.footerOverlay} testID="detail-floating-footer">
          <View style={styles.footerMainRow}>
            <View style={styles.tagRow} testID="detail-tag-row">
              {viewerTags.map((tag) => {
                const tone = resolveTagTone(tag);

                return (
                  <View
                    key={`${activeDetailCandidate.id}-${tag}`}
                    style={[
                      styles.tagPill,
                      tone === 'danger'
                        ? styles.tagPillDanger
                        : tone === 'warning'
                          ? styles.tagPillWarning
                          : styles.tagPillNeutral,
                    ]}
                    testID={`detail-viewer-tag-${tag}`}
                  >
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.actionGroup}>
              <ActionSwitch
                primaryLabel={primaryLabel}
                secondaryLabel={secondaryLabel}
                onPrimaryPress={handlePrimaryActionPress}
                onSecondaryPress={handleSecondaryActionPress}
                primaryIcon={mode === 'recycle' || showKeepAction ? 'checkmark-circle-outline' : 'trash-bin-outline'}
                secondaryIcon="trash-bin-outline"
                primaryTone={mode === 'recycle' || showKeepAction ? 'keep' : 'danger'}
                secondaryTone="danger"
                selectedAction={selectedAction}
                density="compact"
                testID="detail-action-switch"
                primaryTestID={showKeepAction ? 'detail-keep-action' : 'detail-primary-action'}
                secondaryTestID={showKeepAction ? 'detail-primary-action' : 'detail-hard-delete'}
              />
            </View>
          </View>

          {viewerCandidates.length > 1 ? (
            <View style={styles.paginationRow} testID="detail-pagination">
              {viewerCandidates.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.paginationDot,
                    index === activeCandidateIndex && styles.paginationDotActive,
                  ]}
                  testID={
                    index === activeCandidateIndex
                      ? `detail-pagination-dot-active-${item.id}`
                      : `detail-pagination-dot-${item.id}`
                  }
                />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function createStyles(insets: { top: number; bottom: number; left: number; right: number }) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
      paddingTop: Math.max(insets.top, 16),
      paddingBottom: Math.max(insets.bottom, 18),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: 34,
      marginBottom: 10,
      paddingLeft: 16 + insets.left,
      paddingRight: 16 + insets.right,
      zIndex: 10,
      elevation: 10,
    },
    indexText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    closeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.14)',
      zIndex: 11,
      elevation: 11,
    },
    closeButtonPressed: {
      backgroundColor: 'rgba(255, 255, 255, 0.22)',
    },
    stageWrap: {
      flex: 1,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 280,
      paddingBottom: 124,
    },
    singleStage: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    singleStageImage: {
      width: '100%',
      height: '100%',
    },
    footerOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      gap: 10,
      paddingLeft: 16 + insets.left,
      paddingRight: 16 + insets.right,
      paddingBottom: Math.max(insets.bottom, 12),
    },
    footerMainRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
    },
    tagRow: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'nowrap',
      gap: 5,
      alignItems: 'center',
      minHeight: 36,
      overflow: 'hidden',
    },
    tagPill: {
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 11,
    },
    tagPillDanger: {
      backgroundColor: '#ff3b30',
    },
    tagPillWarning: {
      backgroundColor: '#ffb800',
    },
    tagPillNeutral: {
      backgroundColor: '#6b7280',
    },
    tagText: {
      color: '#ffffff',
      fontSize: 8,
      fontWeight: '800',
    },
    actionGroup: {
      justifyContent: 'flex-end',
    },
    paginationRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      minHeight: 14,
    },
    paginationDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.24)',
    },
    paginationDotActive: {
      width: 24,
      borderRadius: 6,
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
    },
  });
}
