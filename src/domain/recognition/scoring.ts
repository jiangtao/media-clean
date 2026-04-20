import type {
  CleanupCandidate,
  CleanupConfidence,
  CleanupIssueType,
  CleanupKind,
  MediaAssetSnapshot,
  MediaType,
  VisualMetrics,
} from './types';

const ISSUE_PRIORITY: CleanupIssueType[] = ['duplicate', 'abnormal', 'accidental'];
const DUPLICATE_EXACT_DISTANCE = 2;
const DUPLICATE_NEAR_DISTANCE = 10;

export interface AnalyzedMediaInput {
  asset: MediaAssetSnapshot;
  metrics: VisualMetrics;
  fingerprint: string | null;
  differenceHash?: string | null;
  contentHash?: string | null;
  frameFingerprints?: string[];
  analysisStatus?: 'ok' | 'fallback';
}

interface DuplicateAssessment {
  groupId: string;
  representativeId: string;
  relation: 'exact' | 'near';
  size: number;
  similarity: number;
  representativeReason: 'higher-resolution' | 'larger-file' | 'newer-capture';
  representativeWidth: number;
  representativeHeight: number;
  representativeFileSize: number;
  representativeCreationTime: number;
}

function resolveConfidence(score: number): CleanupConfidence {
  if (score >= 80) {
    return 'high';
  }

  if (score >= 55) {
    return 'medium';
  }

  return 'low';
}

function resolveKind(mediaType: MediaType, issueType: CleanupIssueType): CleanupKind {
  if (issueType === 'duplicate') {
    return mediaType === 'video' ? 'duplicate-video' : 'duplicate-photo';
  }

  if (issueType === 'abnormal') {
    return mediaType === 'video' ? 'abnormal-video' : 'abnormal-photo';
  }

  return mediaType === 'video' ? 'accidental-video' : 'accidental-photo';
}

function createCandidate(
  asset: MediaAssetSnapshot,
  issueType: CleanupIssueType,
): CleanupCandidate {
  return {
    id: asset.id,
    asset,
    score: 0,
    confidence: 'low',
    kind: resolveKind(asset.mediaType, issueType),
    primaryIssueType: issueType,
    issueTypes: [issueType],
    reasons: [],
  };
}

function finalizeCandidate(candidate: CleanupCandidate) {
  candidate.score = Math.min(candidate.score, 100);
  candidate.confidence = resolveConfidence(candidate.score);
  return candidate;
}

function pushReason(candidate: CleanupCandidate, reason: string, scoreDelta: number) {
  candidate.score += scoreDelta;
  candidate.reasons.push(reason);
}

export function createFallbackCandidate(asset: MediaAssetSnapshot): CleanupCandidate {
  return createCandidate(asset, 'accidental');
}

function scoreAccidentalPhoto(asset: MediaAssetSnapshot, metrics: VisualMetrics) {
  const candidate = createCandidate(asset, 'accidental');

  if (metrics.brightness < 0.18) {
    pushReason(candidate, '画面明显过暗', 35);
  } else if (metrics.brightness < 0.26 && (metrics.contrast < 0.14 || metrics.edgeDensity < 0.12)) {
    pushReason(candidate, '画面明显过暗', 20);
  }

  if (metrics.edgeDensity < 0.1) {
    pushReason(candidate, '边缘信息很少', 25);
  } else if (metrics.edgeDensity < 0.14 && metrics.contrast < 0.14) {
    pushReason(candidate, '边缘信息很少', 15);
  }

  if (asset.fileSize > 0 && asset.fileSize < 400_000) {
    pushReason(candidate, '文件尺寸较小', 20);
  } else if (
    asset.fileSize > 0 &&
    asset.fileSize < 1_200_000 &&
    (metrics.edgeDensity < 0.12 || metrics.contrast < 0.12)
  ) {
    pushReason(candidate, '文件尺寸较小', 10);
  }

  if (Math.max(asset.width, asset.height) < 1_440) {
    pushReason(candidate, '分辨率较低', 10);
  } else if (
    Math.max(asset.width, asset.height) < 2_000 &&
    (metrics.edgeDensity < 0.12 || metrics.contrast < 0.12)
  ) {
    pushReason(candidate, '分辨率较低', 10);
  }

  if (metrics.contrast < 0.1) {
    candidate.score += 10;
  } else if (metrics.contrast < 0.14 && metrics.edgeDensity < 0.12) {
    candidate.score += 10;
  }

  return finalizeCandidate(candidate);
}

function scoreAccidentalVideo(asset: MediaAssetSnapshot, metrics: VisualMetrics) {
  const candidate = createCandidate(asset, 'accidental');

  if (asset.duration <= 2.5) {
    pushReason(candidate, '视频时长极短', 45);
  } else if (asset.duration <= 5) {
    pushReason(candidate, '视频时长较短', 20);
  }

  if (metrics.brightness < 0.18) {
    pushReason(candidate, '缩略图明显过暗', 25);
  }

  if (metrics.edgeDensity < 0.1) {
    pushReason(candidate, '缩略图边缘信息很少', 10);
  }

  if (asset.fileSize > 0 && asset.fileSize < 5_000_000) {
    pushReason(candidate, '视频文件较小', 10);
  }

  return finalizeCandidate(candidate);
}

function hasExtremeAspectRatio(asset: MediaAssetSnapshot) {
  if (asset.width <= 0 || asset.height <= 0) {
    return false;
  }

  const ratio = asset.width / asset.height;
  return ratio > 3.2 || ratio < 0.31;
}

function scoreAbnormalPhoto(
  asset: MediaAssetSnapshot,
  metrics: VisualMetrics,
  analysisStatus: 'ok' | 'fallback' = 'ok',
) {
  const candidate = createCandidate(asset, 'abnormal');

  if (analysisStatus === 'fallback') {
    pushReason(candidate, '媒体内容分析失败', 55);
  }

  if (asset.fileSize === 0) {
    pushReason(candidate, '媒体文件为空', 40);
  }

  if (asset.width <= 0 || asset.height <= 0) {
    pushReason(candidate, '媒体元数据异常', 40);
  }

  if (metrics.brightness < 0.08 || (metrics.brightness > 0.96 && metrics.contrast < 0.05)) {
    pushReason(candidate, '画面接近全黑', 35);
  }

  if (metrics.edgeDensity < 0.04 && metrics.contrast < 0.08) {
    pushReason(candidate, '几乎没有可见内容', 35);
  }

  if (metrics.contrast < 0.05 && metrics.edgeDensity < 0.06) {
    pushReason(candidate, '画面层次异常单一', 20);
  }

  if (asset.fileSize > 0 && asset.fileSize < 120_000) {
    pushReason(candidate, '媒体尺寸异常小', 20);
  }

  if (Math.max(asset.width, asset.height) < 720) {
    pushReason(candidate, '分辨率异常低', 20);
  }

  if (hasExtremeAspectRatio(asset)) {
    pushReason(candidate, '画面比例异常', 20);
  }

  return finalizeCandidate(candidate);
}

function scoreAbnormalVideo(
  asset: MediaAssetSnapshot,
  metrics: VisualMetrics,
  analysisStatus: 'ok' | 'fallback' = 'ok',
) {
  const candidate = createCandidate(asset, 'abnormal');

  if (analysisStatus === 'fallback') {
    pushReason(candidate, '媒体内容分析失败', 55);
  }

  if (asset.fileSize === 0) {
    pushReason(candidate, '媒体文件为空', 40);
  }

  if (asset.width <= 0 || asset.height <= 0) {
    pushReason(candidate, '媒体元数据异常', 40);
  }

  if (asset.duration > 0 && asset.duration <= 1.2) {
    pushReason(candidate, '媒体时长异常短', 45);
  } else if (asset.duration > 0 && asset.duration <= 2.5) {
    pushReason(candidate, '媒体时长异常短', 25);
  }

  if (metrics.brightness < 0.08 || (metrics.brightness > 0.96 && metrics.contrast < 0.05)) {
    pushReason(candidate, '缩略图接近全黑', 25);
  }

  if (metrics.edgeDensity < 0.04 && metrics.contrast < 0.08) {
    pushReason(candidate, '缩略图几乎没有内容', 30);
  }

  if (metrics.contrast < 0.05 && metrics.edgeDensity < 0.06) {
    pushReason(candidate, '缩略图层次异常单一', 15);
  }

  if (asset.fileSize > 0 && asset.fileSize < 1_000_000) {
    pushReason(candidate, '视频文件异常小', 15);
  }

  if (Math.max(asset.width, asset.height) < 720) {
    pushReason(candidate, '分辨率异常低', 15);
  }

  if (hasExtremeAspectRatio(asset)) {
    pushReason(candidate, '画面比例异常', 15);
  }

  return finalizeCandidate(candidate);
}

export function classifyAccidentalMedia(
  asset: MediaAssetSnapshot,
  metrics: VisualMetrics,
): CleanupCandidate {
  return asset.mediaType === 'video'
    ? scoreAccidentalVideo(asset, metrics)
    : scoreAccidentalPhoto(asset, metrics);
}

export function classifyAbnormalMedia(
  asset: MediaAssetSnapshot,
  metrics: VisualMetrics,
  analysisStatus: 'ok' | 'fallback' = 'ok',
): CleanupCandidate {
  return asset.mediaType === 'video'
    ? scoreAbnormalVideo(asset, metrics, analysisStatus)
    : scoreAbnormalPhoto(asset, metrics, analysisStatus);
}

function issuePriority(issueType: CleanupIssueType) {
  return ISSUE_PRIORITY.indexOf(issueType);
}

function mergeIssueTypes(left: CleanupIssueType[], right: CleanupIssueType[], primary: CleanupIssueType) {
  const unique = Array.from(new Set([primary, ...left, ...right]));

  return unique.sort((a, b) => {
    if (a === primary) {
      return -1;
    }

    if (b === primary) {
      return 1;
    }

    return issuePriority(a) - issuePriority(b);
  });
}

function mergeReasons(primary: CleanupCandidate, secondary?: CleanupCandidate) {
  if (!secondary) {
    return [...primary.reasons];
  }

  return Array.from(new Set([...primary.reasons, ...secondary.reasons]));
}

function mergeRecognitionCandidate(
  current: CleanupCandidate | undefined,
  incoming: CleanupCandidate,
): CleanupCandidate {
  if (!current) {
    return {
      ...incoming,
      reasons: [...incoming.reasons],
      issueTypes: [...incoming.issueTypes],
    };
  }

  const preferIncoming =
    incoming.score > current.score ||
    (incoming.score === current.score &&
      issuePriority(incoming.primaryIssueType) < issuePriority(current.primaryIssueType));
  const primary = preferIncoming ? incoming : current;
  const secondary = preferIncoming ? current : incoming;

  return {
    ...primary,
    reasons: mergeReasons(primary, secondary),
    issueTypes: mergeIssueTypes(current.issueTypes, incoming.issueTypes, primary.primaryIssueType),
    duplicateGroup: primary.duplicateGroup ?? secondary.duplicateGroup,
  };
}

function calculateHashDistance(left: string, right: string) {
  if (left.length !== right.length) {
    return Number.POSITIVE_INFINITY;
  }

  let distance = 0;

  for (let index = 0; index < left.length; index += 1) {
    const xor = Number.parseInt(left[index], 16) ^ Number.parseInt(right[index], 16);
    distance += xor.toString(2).replaceAll('0', '').length;
  }

  return distance;
}

function safeRatio(left: number, right: number) {
  if (left <= 0 || right <= 0) {
    return 1;
  }

  return Math.max(left, right) / Math.min(left, right);
}

function hasExactContentHashMatch(
  left: AnalyzedMediaInput,
  right: AnalyzedMediaInput,
) {
  if (left.asset.mediaType !== right.asset.mediaType) {
    return false;
  }

  return Boolean(left.contentHash && right.contentHash && left.contentHash === right.contentHash);
}

function compareMediaSimilarity(
  left: AnalyzedMediaInput,
  right: AnalyzedMediaInput,
): DuplicateAssessment | null {
  if (left.asset.mediaType !== right.asset.mediaType) {
    return null;
  }

  let relation: 'exact' | 'near';
  let similarity: number;

  if (left.asset.mediaType === 'video') {
    const videoSimilarity = compareVideoFrameSimilarity(left, right);
    if (!videoSimilarity) {
      return null;
    }

    relation = videoSimilarity.relation;
    similarity = videoSimilarity.similarity;
  } else {
    if (hasExactContentHashMatch(left, right)) {
      relation = 'exact';
      similarity = 1;
    } else {
      const averageHash = left.fingerprint;
      const nextAverageHash = right.fingerprint;
      const differenceHash = left.differenceHash ?? left.fingerprint;
      const nextDifferenceHash = right.differenceHash ?? right.fingerprint;

      if (!averageHash || !nextAverageHash || !differenceHash || !nextDifferenceHash) {
        return null;
      }

      const averageDistance = calculateHashDistance(averageHash, nextAverageHash);
      const differenceDistance = calculateHashDistance(differenceHash, nextDifferenceHash);

      if (
        averageDistance > DUPLICATE_NEAR_DISTANCE ||
        differenceDistance > DUPLICATE_NEAR_DISTANCE
      ) {
        return null;
      }

      relation =
        averageDistance <= DUPLICATE_EXACT_DISTANCE &&
        differenceDistance <= DUPLICATE_EXACT_DISTANCE
          ? 'exact'
          : 'near';
      similarity = Math.max(0, 1 - (averageDistance + differenceDistance) / 128);
    }
  }

  const aspectRatioDelta = Math.abs(
    left.asset.width / Math.max(left.asset.height, 1) -
      right.asset.width / Math.max(right.asset.height, 1),
  );
  if (aspectRatioDelta > 0.08) {
    return null;
  }

  if (left.asset.mediaType === 'video' && Math.abs(left.asset.duration - right.asset.duration) > 1.2) {
    return null;
  }

  if (
    left.asset.mediaType === 'video' &&
    safeRatio(left.asset.fileSize, right.asset.fileSize) > 2.2
  ) {
    return null;
  }

  if (
    left.asset.mediaType === 'video' &&
    safeRatio(left.asset.width * left.asset.height, right.asset.width * right.asset.height) > 5
  ) {
    return null;
  }

  return {
    groupId: '',
    representativeId: '',
    relation,
    size: 0,
    similarity,
    representativeReason: 'higher-resolution',
    representativeWidth: 0,
    representativeHeight: 0,
    representativeFileSize: 0,
    representativeCreationTime: 0,
  };
}

function compareVideoFrameSimilarity(left: AnalyzedMediaInput, right: AnalyzedMediaInput) {
  const leftFrames =
    left.frameFingerprints && left.frameFingerprints.length > 0
      ? left.frameFingerprints
      : left.fingerprint
        ? [left.fingerprint]
        : [];
  const rightFrames =
    right.frameFingerprints && right.frameFingerprints.length > 0
      ? right.frameFingerprints
      : right.fingerprint
        ? [right.fingerprint]
        : [];

  const comparableCount = Math.min(leftFrames.length, rightFrames.length);
  if (comparableCount === 0) {
    return null;
  }

  const distances = new Array<number>(comparableCount)
    .fill(0)
    .map((_, index) => calculateHashDistance(leftFrames[index], rightFrames[index]))
    .filter((distance) => Number.isFinite(distance))
    .sort((leftDistance, rightDistance) => leftDistance - rightDistance);

  const requiredMatches = comparableCount >= 7 ? 3 : comparableCount >= 4 ? 2 : 1;
  if (distances.length < requiredMatches) {
    return null;
  }

  const matched = distances.slice(0, requiredMatches);
  const worstMatchedDistance = matched[matched.length - 1];
  if (worstMatchedDistance > DUPLICATE_NEAR_DISTANCE) {
    return null;
  }

  const averageDistance =
    matched.reduce((sum, distance) => sum + distance, 0) / matched.length;

  return {
    relation:
      worstMatchedDistance <= DUPLICATE_EXACT_DISTANCE ? ('exact' as const) : ('near' as const),
    similarity: Math.max(0, 1 - averageDistance / 64),
  };
}

function resolveRepresentativeReason(items: AnalyzedMediaInput[], representative: AnalyzedMediaInput) {
  const representativeArea = representative.asset.width * representative.asset.height;
  const highestArea = Math.max(...items.map((item) => item.asset.width * item.asset.height));
  if (
    representativeArea === highestArea &&
    items.some((item) => item.asset.id !== representative.asset.id && item.asset.width * item.asset.height < representativeArea)
  ) {
    return 'higher-resolution' as const;
  }

  const representativeFileSize = representative.asset.fileSize;
  const largestFileSize = Math.max(...items.map((item) => item.asset.fileSize));
  if (
    representativeFileSize === largestFileSize &&
    items.some((item) => item.asset.id !== representative.asset.id && item.asset.fileSize < representativeFileSize)
  ) {
    return 'larger-file' as const;
  }

  return 'newer-capture' as const;
}

function pickRepresentative(items: AnalyzedMediaInput[]) {
  return [...items].sort((left, right) => {
    const fallbackDelta =
      Number(left.analysisStatus === 'fallback') - Number(right.analysisStatus === 'fallback');
    if (fallbackDelta !== 0) {
      return fallbackDelta;
    }

    const areaDelta = right.asset.width * right.asset.height - left.asset.width * left.asset.height;
    if (areaDelta !== 0) {
      return areaDelta;
    }

    const sizeDelta = right.asset.fileSize - left.asset.fileSize;
    if (sizeDelta !== 0) {
      return sizeDelta;
    }

    return right.asset.creationTime - left.asset.creationTime;
  })[0];
}

function buildDuplicateCandidates(items: AnalyzedMediaInput[]) {
  const parent = new Map<string, string>();
  const indexById = new Map(items.map((item) => [item.asset.id, item]));

  for (const item of items) {
    parent.set(item.asset.id, item.asset.id);
  }

  const find = (id: string): string => {
    const current = parent.get(id);
    if (!current || current === id) {
      return id;
    }

    const root = find(current);
    parent.set(id, root);
    return root;
  };

  const union = (left: string, right: string) => {
    const leftRoot = find(left);
    const rightRoot = find(right);

    if (leftRoot !== rightRoot) {
      parent.set(rightRoot, leftRoot);
    }
  };

  for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
      if (compareMediaSimilarity(items[leftIndex], items[rightIndex])) {
        union(items[leftIndex].asset.id, items[rightIndex].asset.id);
      }
    }
  }

  const groups = new Map<string, AnalyzedMediaInput[]>();
  for (const item of items) {
    const groupId = find(item.asset.id);
    const group = groups.get(groupId) ?? [];
    group.push(item);
    groups.set(groupId, group);
  }

  const candidates: CleanupCandidate[] = [];

  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }

    const representative = pickRepresentative(group);
    const representativeReason = resolveRepresentativeReason(group, representative);
    const groupId = `duplicate-${group
      .map((item) => item.asset.id)
      .sort()
      .join('-')}`;

    for (const item of group) {
      if (item.asset.id === representative.asset.id) {
        continue;
      }

      const similarity = compareMediaSimilarity(item, representative);
      if (!similarity) {
        continue;
      }

      const candidate = createCandidate(item.asset, 'duplicate');
      pushReason(
        candidate,
        similarity.relation === 'exact' ? '与其他媒体高度相似' : '与其他媒体内容近似',
        similarity.relation === 'exact' ? 86 : 68,
      );
      pushReason(candidate, '已保留一份更高质量副本', 0);
      candidate.duplicateGroup = {
        groupId,
        representativeId: representative.asset.id,
        relation: similarity.relation,
        size: group.length,
        similarity: similarity.similarity,
        representativeReason,
        representativeWidth: representative.asset.width,
        representativeHeight: representative.asset.height,
        representativeFileSize: representative.asset.fileSize,
        representativeCreationTime: representative.asset.creationTime,
      };
      candidates.push(finalizeCandidate(candidate));
    }
  }

  return candidates;
}

export function buildCleanupCandidates(inputs: AnalyzedMediaInput[]) {
  const merged = new Map<string, CleanupCandidate>();

  for (const input of inputs) {
    const accidental = classifyAccidentalMedia(input.asset, input.metrics);
    if (accidental.score > 0) {
      merged.set(input.asset.id, mergeRecognitionCandidate(merged.get(input.asset.id), accidental));
    }

    const abnormal = classifyAbnormalMedia(
      input.asset,
      input.metrics,
      input.analysisStatus ?? 'ok',
    );
    if (abnormal.score > 0) {
      merged.set(input.asset.id, mergeRecognitionCandidate(merged.get(input.asset.id), abnormal));
    }
  }

  for (const duplicate of buildDuplicateCandidates(inputs)) {
    merged.set(duplicate.id, mergeRecognitionCandidate(merged.get(duplicate.id), duplicate));
  }

  return sortCandidatesByScore([...merged.values()]);
}

export function sortCandidatesByScore(candidates: CleanupCandidate[]): CleanupCandidate[] {
  return [...candidates].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return right.asset.creationTime - left.asset.creationTime;
  });
}
