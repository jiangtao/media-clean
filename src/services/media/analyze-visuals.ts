import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/src/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { toByteArray } from 'base64-js';
import * as jpeg from 'jpeg-js';

import {
  calculateAverageHashFromRgba,
  calculateDifferenceHashFromRgba,
  calculateVisualMetricsFromRgba,
} from '../../domain/recognition/image-metrics';
import type { MediaType, VisualMetrics } from '../../domain/recognition/types';

if (!globalThis.Buffer) {
  globalThis.Buffer = Buffer;
}

const FALLBACK_METRICS: VisualMetrics = {
  brightness: 0.5,
  contrast: 0.2,
  edgeDensity: 0.2,
};

export interface VisualAnalysisResult {
  metrics: VisualMetrics;
  previewUri: string;
  fingerprint: string | null;
  differenceHash: string | null;
  frameFingerprints: string[];
  status: 'ok' | 'fallback';
}

async function deleteGeneratedFile(uri: string, protectedUri?: string) {
  if (!uri || uri === protectedUri || !uri.startsWith('file://')) {
    return;
  }

  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Best-effort cleanup: analysis correctness must not depend on cache eviction.
  }
}

async function loadJpegPixels(sourceUri: string) {
  let reducedUri: string | null = null;

  try {
    const reduced = await manipulateAsync(
      sourceUri,
      [{ resize: { width: 48 } }],
      {
        base64: true,
        compress: 0.65,
        format: SaveFormat.JPEG,
      },
    );
    reducedUri = reduced.uri;

    if (!reduced.base64) {
      throw new Error('No base64 returned from image manipulator.');
    }

    const decoded = jpeg.decode(toByteArray(reduced.base64), { useTArray: true });

    return {
      rgba: decoded.data,
      width: decoded.width,
      height: decoded.height,
    };
  } finally {
    if (reducedUri) {
      await deleteGeneratedFile(reducedUri, sourceUri);
    }
  }
}

interface ReducedFrameAnalysis {
  metrics: VisualMetrics;
  fingerprint: string | null;
  differenceHash: string | null;
}

async function analyzeReducedFrame(sourceUri: string): Promise<ReducedFrameAnalysis> {
  const reduced = await loadJpegPixels(sourceUri);

  return {
    metrics: calculateVisualMetricsFromRgba(reduced.rgba, reduced.width, reduced.height),
    fingerprint: calculateAverageHashFromRgba(reduced.rgba, reduced.width, reduced.height),
    differenceHash: calculateDifferenceHashFromRgba(reduced.rgba, reduced.width, reduced.height),
  };
}

export function buildVideoSampleTimes(durationSeconds: number) {
  const durationMs = Math.max(0, Math.round(durationSeconds * 1000));
  if (durationMs <= 0) {
    return [0];
  }

  const lastSafeMs = Math.max(0, durationMs - 250);
  if (lastSafeMs <= 0) {
    return [0];
  }

  const sampleCount = durationMs <= 5_000 ? 3 : durationMs <= 20_000 ? 5 : 7;
  const marginRatio = durationMs <= 5_000 ? 0.14 : durationMs <= 20_000 ? 0.16 : 0.18;
  const windowStartMs = Math.min(Math.round(durationMs * marginRatio), lastSafeMs);
  const windowEndMs = Math.max(
    windowStartMs,
    Math.min(lastSafeMs, Math.round(durationMs * (1 - marginRatio))),
  );
  const windowSpanMs = Math.max(0, windowEndMs - windowStartMs);
  const samples = Array.from({ length: sampleCount }, (_, index) =>
    Math.max(
      0,
      Math.min(
        Math.round(windowStartMs + (windowSpanMs * (index + 0.5)) / sampleCount),
        lastSafeMs,
      ),
    ),
  );

  return Array.from(new Set(samples)).sort((left, right) => left - right);
}

async function analyzeVideoFrames(assetUri: string, durationSeconds: number) {
  const results = await Promise.all(
    buildVideoSampleTimes(durationSeconds).map(async (time) => {
      let thumbnailUri: string | null = null;

      try {
        const thumbnail = await getThumbnailAsync(assetUri, { quality: 0.4, time });
        thumbnailUri = thumbnail.uri;
        return await analyzeReducedFrame(thumbnail.uri);
      } catch {
        return null;
      } finally {
        if (thumbnailUri) {
          await deleteGeneratedFile(thumbnailUri, assetUri);
        }
      }
    }),
  );

  return results.filter((result): result is ReducedFrameAnalysis => Boolean(result));
}

export async function analyzeVisualsForAsset(
  assetUri: string,
  mediaType: MediaType,
  durationSeconds = 0,
): Promise<VisualAnalysisResult> {
  try {
    if (mediaType === 'video') {
      const frames = await analyzeVideoFrames(assetUri, durationSeconds);
      if (frames.length === 0) {
        throw new Error('No frames analyzed.');
      }

      return {
        previewUri: assetUri,
        metrics: frames[0].metrics,
        fingerprint: frames[0].fingerprint,
        differenceHash: frames[0].differenceHash,
        frameFingerprints: frames
          .map((frame) => frame.fingerprint)
          .filter((fingerprint): fingerprint is string => Boolean(fingerprint)),
        status: 'ok',
      };
    }

    const reduced = await analyzeReducedFrame(assetUri);

    return {
      previewUri: assetUri,
      metrics: reduced.metrics,
      fingerprint: reduced.fingerprint,
      differenceHash: reduced.differenceHash,
      frameFingerprints: reduced.fingerprint ? [reduced.fingerprint] : [],
      status: 'ok',
    };
  } catch {
    return {
      previewUri: assetUri,
      metrics: FALLBACK_METRICS,
      fingerprint: null,
      differenceHash: null,
      frameFingerprints: [],
      status: 'fallback',
    };
  }
}
