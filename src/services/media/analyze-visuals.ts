import { Buffer } from 'buffer';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { getThumbnailAsync } from 'expo-video-thumbnails';
import { toByteArray } from 'base64-js';
import * as jpeg from 'jpeg-js';

import {
  calculateAverageHashFromRgba,
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
  frameFingerprints: string[];
  status: 'ok' | 'fallback';
}

async function loadJpegPixels(sourceUri: string) {
  const reduced = await manipulateAsync(
    sourceUri,
    [{ resize: { width: 48 } }],
    {
      base64: true,
      compress: 0.65,
      format: SaveFormat.JPEG,
    },
  );

  if (!reduced.base64) {
    throw new Error('No base64 returned from image manipulator.');
  }

  const decoded = jpeg.decode(toByteArray(reduced.base64), { useTArray: true });

  return {
    rgba: decoded.data,
    width: decoded.width,
    height: decoded.height,
    previewUri: reduced.uri,
  };
}

interface ReducedFrameAnalysis {
  previewUri: string;
  metrics: VisualMetrics;
  fingerprint: string | null;
}

async function analyzeReducedFrame(sourceUri: string): Promise<ReducedFrameAnalysis> {
  const reduced = await loadJpegPixels(sourceUri);

  return {
    previewUri: reduced.previewUri,
    metrics: calculateVisualMetricsFromRgba(reduced.rgba, reduced.width, reduced.height),
    fingerprint: calculateAverageHashFromRgba(reduced.rgba, reduced.width, reduced.height),
  };
}

export function buildVideoSampleTimes(durationSeconds: number) {
  const durationMs = Math.max(0, Math.round(durationSeconds * 1000));
  if (durationMs <= 0) {
    return [0];
  }

  const lastSafeMs = Math.max(0, durationMs - 250);
  const sampleCount = durationMs <= 5_000 ? 3 : durationMs <= 20_000 ? 5 : 7;
  const samples = [0];

  for (let index = 1; index < sampleCount; index += 1) {
    samples.push(Math.max(0, Math.min(Math.round((lastSafeMs * index) / sampleCount), lastSafeMs)));
  }

  return Array.from(new Set(samples));
}

async function analyzeVideoFrames(assetUri: string, durationSeconds: number) {
  const results = await Promise.all(
    buildVideoSampleTimes(durationSeconds).map(async (time) => {
      try {
        const thumbnail = await getThumbnailAsync(assetUri, { quality: 0.4, time });
        return await analyzeReducedFrame(thumbnail.uri);
      } catch {
        return null;
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
        previewUri: frames[0].previewUri,
        metrics: frames[0].metrics,
        fingerprint: frames[0].fingerprint,
        frameFingerprints: frames
          .map((frame) => frame.fingerprint)
          .filter((fingerprint): fingerprint is string => Boolean(fingerprint)),
        status: 'ok',
      };
    }

    const reduced = await analyzeReducedFrame(assetUri);

    return {
      previewUri: reduced.previewUri,
      metrics: reduced.metrics,
      fingerprint: reduced.fingerprint,
      frameFingerprints: reduced.fingerprint ? [reduced.fingerprint] : [],
      status: 'ok',
    };
  } catch {
    return {
      previewUri: assetUri,
      metrics: FALLBACK_METRICS,
      fingerprint: null,
      frameFingerprints: [],
      status: 'fallback',
    };
  }
}
