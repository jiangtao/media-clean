import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import type { CleanupCandidate } from '../../domain/recognition/types';
import { getAppTheme } from '../../theme/app-theme';
import { COMPONENT_TOKENS } from '../../theme/generated/component-tokens.generated';
import { PREVIEW_MODAL_STYLE_TOKENS, PreviewModal } from '../PreviewModal';

vi.mock('expo-image', () => ({
  Image: 'Image',
}));

vi.mock('expo-video', () => ({
  VideoView: 'VideoView',
  useVideoPlayer: () => ({
    loop: false,
    play: vi.fn(),
  }),
}));

vi.mock('react-native', () => ({
  Dimensions: {
    get: () => ({ width: 390, height: 844 }),
  },
  Modal: 'Modal',
  PixelRatio: {
    get: () => 3,
  },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: 'Text',
  View: 'View',
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
  id: 'preview-candidate',
  asset: {
    id: 'asset-preview',
    uri: 'file:///preview.jpg',
    previewUri: 'file:///preview-thumbnail.jpg',
    mediaType: 'photo',
    width: 3024,
    height: 4032,
    duration: 0,
    fileSize: 2_400_000,
    creationTime: new Date('2026-04-16T08:00:00+08:00').getTime(),
  },
  score: 82,
  confidence: 'high',
  kind: 'abnormal-photo',
  primaryIssueType: 'abnormal',
  issueTypes: ['abnormal'],
  reasons: ['blurry'],
};

describe('PreviewModal', () => {
  it('uses file-backed component tokens for media, panel, and actions', () => {
    const theme = getAppTheme('light');
    const onClose = vi.fn();
    const onPrimaryAction = vi.fn();
    const onHardDelete = vi.fn();
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <PreviewModal
          candidate={candidate}
          language="zh-CN"
          mode="suggestions"
          theme={theme}
          visible
          onClose={onClose}
          onPrimaryAction={onPrimaryAction}
          onHardDelete={onHardDelete}
        />,
      );
    });

    const mediaStyle = flattenStyle(renderer.root.findByProps({ testID: 'preview-modal-media' }).props.style);
    const panelStyle = flattenStyle(renderer.root.findByProps({ testID: 'preview-modal-judgement-panel' }).props.style);
    const image = renderer.root.findByType('Image');
    const primaryAction = renderer.root.findByProps({ testID: 'preview-modal-primary-action' });
    const hardDelete = renderer.root.findByProps({ testID: 'preview-modal-hard-delete' });

    expect(PREVIEW_MODAL_STYLE_TOKENS).toBe(COMPONENT_TOKENS.previewModal);
    expect(mediaStyle).toMatchObject({
      width: '100%',
      aspectRatio: PREVIEW_MODAL_STYLE_TOKENS.layout.previewAspectRatio,
      borderRadius: PREVIEW_MODAL_STYLE_TOKENS.radius.media,
      backgroundColor: theme.previewBackground,
    });
    expect(image.props.source).toMatchObject({
      width: 350,
      height: 315,
      scale: 3,
    });
    expect(panelStyle).toMatchObject({
      borderRadius: PREVIEW_MODAL_STYLE_TOKENS.radius.panel,
      padding: PREVIEW_MODAL_STYLE_TOKENS.layout.panelPadding,
      borderWidth: PREVIEW_MODAL_STYLE_TOKENS.border.panelWidth,
      gap: PREVIEW_MODAL_STYLE_TOKENS.layout.panelGap,
    });

    act(() => {
      renderer.root.findByProps({ testID: 'preview-modal-close' }).props.onPress();
      primaryAction.props.onPress();
      hardDelete.props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
    expect(onHardDelete).toHaveBeenCalledTimes(1);
  });
});
