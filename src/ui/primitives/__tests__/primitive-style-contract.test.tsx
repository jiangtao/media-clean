import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.unmock('../../theme/app-theme');
vi.unmock('../../../theme/app-theme');
vi.unmock('./src/theme/app-theme');

import { getAppTheme } from '../../../theme/app-theme';
import { PRIMITIVE_TOKENS } from '../../../theme/generated/primitive-tokens.generated';
import {
  Badge,
  Button,
  Card,
  FoldableLayout,
  IconButton,
  MediaFrame,
  Progress,
  Separator,
  Switch,
  Text,
  TouchSurface,
} from '..';

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

function findStyledByTestID(
  renderer: ReturnType<typeof TestRenderer.create>,
  testID: string,
) {
  return renderer.root.findAll(
    (node: { props?: Record<string, unknown> }) =>
      node.props?.testID === testID && node.props.style !== undefined,
  )[0];
}

describe('primitive style contract', () => {
  it('maps Button variants to app-cleaner button, chip, and card tokens', () => {
    const theme = getAppTheme('light');
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <>
          <Button testID="primary" theme={theme} variant="primary">
            开始
          </Button>
          <Button testID="secondary" theme={theme} variant="secondary">
            稍后
          </Button>
          <Button testID="danger" theme={theme} variant="danger">
            清理
          </Button>
          <Button testID="chip" theme={theme} variant="chip">
            已选
          </Button>
        </>,
      );
    });

    expect(flattenStyle(findStyledByTestID(renderer, 'primary').props.style)).toMatchObject({
      backgroundColor: theme.buttonPrimaryBackground,
      borderColor: theme.buttonPrimaryBackground,
      borderRadius: PRIMITIVE_TOKENS.radius.button,
      paddingHorizontal: PRIMITIVE_TOKENS.spacing.buttonPaddingHorizontal,
      paddingVertical: PRIMITIVE_TOKENS.spacing.buttonPaddingVertical,
    });
    expect(flattenStyle(findStyledByTestID(renderer, 'secondary').props.style)).toMatchObject({
      backgroundColor: theme.buttonSecondaryBackground,
      borderColor: theme.cardBorder,
    });
    expect(flattenStyle(findStyledByTestID(renderer, 'danger').props.style)).toMatchObject({
      backgroundColor: theme.buttonDangerBackground,
      borderColor: theme.buttonDangerBackground,
    });
    expect(flattenStyle(findStyledByTestID(renderer, 'chip').props.style)).toMatchObject({
      backgroundColor: theme.chipActiveBackground,
      borderColor: theme.chipBorder,
    });
  });

  it('maps Text variants to app-cleaner text colors and generated typography tokens', () => {
    const theme = getAppTheme('dark');
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <>
          <Text testID="title" theme={theme} variant="title" tone="primary">
            标题
          </Text>
          <Text testID="caption" theme={theme} variant="caption" tone="muted">
            说明
          </Text>
          <Text testID="button-label" theme={theme} variant="button" tone="onButton">
            操作
          </Text>
        </>,
      );
    });

    expect(flattenStyle(findStyledByTestID(renderer, 'title').props.style)).toMatchObject({
      ...PRIMITIVE_TOKENS.typography.title,
      color: theme.pageTextPrimary,
    });
    expect(flattenStyle(findStyledByTestID(renderer, 'caption').props.style)).toMatchObject({
      ...PRIMITIVE_TOKENS.typography.caption,
      color: theme.pageTextMuted,
    });
    expect(flattenStyle(findStyledByTestID(renderer, 'button-label').props.style)).toMatchObject({
      ...PRIMITIVE_TOKENS.typography.button,
      color: theme.buttonPrimaryText,
    });
  });

  it('maps Card and Separator to app-cleaner card tokens plus generated radius and spacing', () => {
    const theme = getAppTheme('light');
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <>
          <Card testID="card" theme={theme} />
          <Card testID="muted-card" theme={theme} variant="muted" />
          <Separator testID="separator" theme={theme} />
        </>,
      );
    });

    expect(flattenStyle(findStyledByTestID(renderer, 'card').props.style)).toMatchObject({
      backgroundColor: theme.cardBackground,
      borderColor: theme.cardBorder,
      borderRadius: PRIMITIVE_TOKENS.radius.card,
      padding: PRIMITIVE_TOKENS.spacing.cardPadding,
    });
    expect(flattenStyle(findStyledByTestID(renderer, 'muted-card').props.style)).toMatchObject({
      backgroundColor: theme.cardMutedBackground,
      borderColor: theme.cardMutedBorder,
    });
    expect(flattenStyle(findStyledByTestID(renderer, 'separator').props.style)).toMatchObject({
      backgroundColor: theme.cardBorder,
      height: PRIMITIVE_TOKENS.spacing.separatorThickness,
    });
  });

  it('maps Badge and Progress primitive sizing to generated spacing tokens', () => {
    const theme = getAppTheme('light');
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <>
          <Badge testID="badge" theme={theme}>
            9
          </Badge>
          <Progress testID="progress" theme={theme} value={42} />
        </>,
      );
    });

    expect(flattenStyle(findStyledByTestID(renderer, 'badge').props.style)).toMatchObject({
      borderRadius: PRIMITIVE_TOKENS.radius.button,
      borderWidth: PRIMITIVE_TOKENS.spacing.badgeBorderWidth,
      minHeight: PRIMITIVE_TOKENS.spacing.badgeMinHeight,
      paddingHorizontal: PRIMITIVE_TOKENS.spacing.badgePaddingHorizontal,
      paddingVertical: PRIMITIVE_TOKENS.spacing.badgePaddingVertical,
    });
    expect(flattenStyle(findStyledByTestID(renderer, 'progress').props.style)).toMatchObject({
      borderRadius: PRIMITIVE_TOKENS.radius.button,
      borderWidth: PRIMITIVE_TOKENS.spacing.progressBorderWidth,
      height: PRIMITIVE_TOKENS.spacing.progressHeight,
    });
  });

  it('maps TouchSurface interaction feedback to generated interaction tokens', () => {
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <TouchSurface testID="touch-tab" preset="tab">
          Tab
        </TouchSurface>,
      );
    });

    const touchSurface = findStyledByTestID(renderer, 'touch-tab');
    expect(touchSurface.props.pressRetentionOffset).toMatchObject(
      PRIMITIVE_TOKENS.interaction.pressRetentionOffset,
    );

    act(() => {
      touchSurface.props.onPressIn({} as never);
    });

    expect(flattenStyle(findStyledByTestID(renderer, 'touch-tab').props.style)).toMatchObject({
      opacity: PRIMITIVE_TOKENS.interaction.touchSurfacePressed.tabOpacity,
      transform: [{ scale: PRIMITIVE_TOKENS.interaction.touchSurfacePressed.tabScale }],
    });
  });

  it('maps IconButton variants to generated size, radius, and app surface tokens', () => {
    const theme = getAppTheme('light');
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <>
          <IconButton testID="icon-button" theme={theme} />
          <IconButton testID="muted-icon-button" theme={theme} variant="muted" />
          <IconButton testID="overlay-icon-button" theme={theme} variant="overlay" />
        </>,
      );
    });

    expect(flattenStyle(findStyledByTestID(renderer, 'icon-button').props.style)).toMatchObject({
      backgroundColor: 'transparent',
      borderRadius: PRIMITIVE_TOKENS.radius.iconButton,
      width: PRIMITIVE_TOKENS.spacing.iconButtonSize,
      height: PRIMITIVE_TOKENS.spacing.iconButtonSize,
    });
    expect(flattenStyle(findStyledByTestID(renderer, 'muted-icon-button').props.style)).toMatchObject({
      backgroundColor: theme.cardMutedBackground,
      borderColor: theme.cardMutedBorder,
      borderWidth: 1,
    });
    expect(flattenStyle(findStyledByTestID(renderer, 'overlay-icon-button').props.style)).toMatchObject({
      backgroundColor: PRIMITIVE_TOKENS.color.iconButtonOverlayBackground,
    });
  });

  it('exports FoldableLayout through the shared primitive index', () => {
    expect(FoldableLayout).toBeDefined();
  });

  it('maps MediaFrame variants to preview and transparent media container tokens', () => {
    const theme = getAppTheme('light');
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <>
          <MediaFrame testID="media-frame" theme={theme} />
          <MediaFrame testID="transparent-media-frame" theme={theme} variant="transparent" />
        </>,
      );
    });

    expect(flattenStyle(findStyledByTestID(renderer, 'media-frame').props.style)).toMatchObject({
      backgroundColor: theme.previewBackground,
      borderRadius: PRIMITIVE_TOKENS.radius.media,
      overflow: 'hidden',
      padding: 0,
      borderWidth: 0,
    });
    expect(
      flattenStyle(findStyledByTestID(renderer, 'transparent-media-frame').props.style),
    ).toMatchObject({
      backgroundColor: 'transparent',
      borderRadius: 0,
      overflow: 'visible',
    });
  });

  it('maps Switch states to chip, button, success, and danger tokens', () => {
    const theme = getAppTheme('dark');
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <>
          <Switch testID="switch-off" theme={theme} checked={false} />
          <Switch testID="switch-on" theme={theme} checked />
          <Switch testID="switch-success" theme={theme} checked tone="success" />
          <Switch testID="switch-danger" theme={theme} checked tone="danger" />
        </>,
      );
    });

    expect(flattenStyle(findStyledByTestID(renderer, 'switch-off').props.style)).toMatchObject({
      backgroundColor: theme.chipBackground,
      borderColor: theme.chipBorder,
      width: PRIMITIVE_TOKENS.spacing.switchWidth,
      height: PRIMITIVE_TOKENS.spacing.switchHeight,
      borderRadius: PRIMITIVE_TOKENS.radius.switchTrack,
    });
    expect(flattenStyle(findStyledByTestID(renderer, 'switch-on').props.style)).toMatchObject({
      backgroundColor: theme.buttonPrimaryBackground,
      borderColor: theme.buttonPrimaryBackground,
    });
    expect(flattenStyle(findStyledByTestID(renderer, 'switch-success').props.style)).toMatchObject({
      backgroundColor: theme.buttonSuccessBackground,
      borderColor: theme.buttonSuccessBackground,
    });
    expect(flattenStyle(findStyledByTestID(renderer, 'switch-danger').props.style)).toMatchObject({
      backgroundColor: theme.buttonDangerBackground,
      borderColor: theme.buttonDangerBackground,
    });
  });
});
