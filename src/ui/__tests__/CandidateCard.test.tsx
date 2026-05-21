import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import type { CleanupCandidate } from '../../domain/recognition/types';
import { getAppTheme } from '../../theme/app-theme';
import { COMPONENT_TOKENS } from '../../theme/generated/component-tokens.generated';
import { CandidateCard, CANDIDATE_CARD_STYLE_TOKENS } from '../CandidateCard';

vi.mock('expo-image', () => ({
  Image: 'Image',
}));

vi.mock('react-native', () => ({
  Image: 'Image',
  PixelRatio: {
    get: () => 3,
  },
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const candidate: CleanupCandidate = {
  id: 'candidate-1',
  asset: {
    id: 'asset-1',
    uri: 'file:///asset-1.jpg',
    previewUri: 'file:///asset-1-preview.jpg',
    mediaType: 'photo',
    width: 3024,
    height: 4032,
    duration: 0,
    fileSize: 2_400_000,
    creationTime: 1_710_000_000_000,
  },
  score: 82,
  confidence: 'high',
  kind: 'abnormal-photo',
  primaryIssueType: 'abnormal',
  issueTypes: ['abnormal'],
  reasons: ['blurry', 'dark', 'low-contrast', 'extra-reason'],
};

describe('CandidateCard', () => {
  it('uses file-backed component tokens for card, thumbnail, and action geometry', () => {
    const theme = getAppTheme('light');
    const onOpen = vi.fn();
    const onToggleSelect = vi.fn();
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <CandidateCard
          candidate={candidate}
          language="zh-CN"
          mode="suggestions"
          onOpen={onOpen}
          onToggleSelect={onToggleSelect}
          selected={false}
          theme={theme}
        />,
      );
    });

    const cardStyle = flattenStyle(renderer.root.findByProps({ testID: 'candidate-card' }).props.style);
    const thumbnail = renderer.root.findByProps({ testID: 'candidate-card-thumbnail' });
    const thumbnailStyle = flattenStyle(thumbnail.props.style);
    const actionButton = renderer.root.findByProps({ testID: 'candidate-card-action' });
    const actionButtonStyle = flattenStyle(actionButton.props.style);

    expect(CANDIDATE_CARD_STYLE_TOKENS).toBe(COMPONENT_TOKENS.candidateCard);
    expect(cardStyle).toMatchObject({
      borderRadius: CANDIDATE_CARD_STYLE_TOKENS.layout.cardRadius,
      padding: CANDIDATE_CARD_STYLE_TOKENS.layout.cardPadding,
      gap: CANDIDATE_CARD_STYLE_TOKENS.layout.cardGap,
      shadowOpacity: CANDIDATE_CARD_STYLE_TOKENS.layout.shadowOpacity,
      shadowRadius: CANDIDATE_CARD_STYLE_TOKENS.layout.shadowRadius,
      elevation: CANDIDATE_CARD_STYLE_TOKENS.layout.elevation,
    });
    expect(thumbnail.props.source).toMatchObject({
      width: CANDIDATE_CARD_STYLE_TOKENS.layout.thumbnailSize,
      height: CANDIDATE_CARD_STYLE_TOKENS.layout.thumbnailSize,
    });
    expect(thumbnailStyle).toMatchObject({
      width: CANDIDATE_CARD_STYLE_TOKENS.layout.thumbnailSize,
      height: CANDIDATE_CARD_STYLE_TOKENS.layout.thumbnailSize,
      borderRadius: CANDIDATE_CARD_STYLE_TOKENS.layout.thumbnailRadius,
    });
    expect(actionButtonStyle).toMatchObject({
      minHeight: CANDIDATE_CARD_STYLE_TOKENS.actionButton.minHeight,
      borderRadius: CANDIDATE_CARD_STYLE_TOKENS.actionButton.radius,
      paddingHorizontal: CANDIDATE_CARD_STYLE_TOKENS.actionButton.paddingHorizontal,
      paddingVertical: CANDIDATE_CARD_STYLE_TOKENS.actionButton.paddingVertical,
    });

    act(() => {
      renderer.root.findByProps({ testID: 'candidate-card-hero' }).props.onPress();
      actionButton.props.onPress();
    });

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onToggleSelect).toHaveBeenCalledTimes(1);
  });
});
