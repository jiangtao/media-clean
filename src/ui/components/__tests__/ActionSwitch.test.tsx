import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { ActionSwitch, ACTION_SWITCH_STYLE_TOKENS } from '../ActionSwitch';

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
}));

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

describe('ActionSwitch', () => {
  it('keeps both actions unfilled when no selected action is provided', () => {
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <ActionSwitch
          primaryLabel="保留"
          secondaryLabel="清除"
          onPrimaryPress={vi.fn()}
          onSecondaryPress={vi.fn()}
          selectedAction={null}
        />,
      );
    });

    const primaryStyle = flattenStyle(
      renderer.root.findByProps({ testID: 'action-switch-primary' }).props.style,
    );
    const secondaryStyle = flattenStyle(
      renderer.root.findByProps({ testID: 'action-switch-secondary' }).props.style,
    );

    expect(primaryStyle.backgroundColor).toBeUndefined();
    expect(secondaryStyle.backgroundColor).toBeUndefined();
  });

  it('highlights the recommended keep action when the primary side is selected', () => {
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <ActionSwitch
          primaryLabel="保留"
          secondaryLabel="清除"
          onPrimaryPress={vi.fn()}
          onSecondaryPress={vi.fn()}
          primaryTone="keep"
          secondaryTone="danger"
          selectedAction="primary"
        />,
      );
    });

    const primaryStyle = flattenStyle(
      renderer.root.findByProps({ testID: 'action-switch-primary' }).props.style,
    );
    const secondaryStyle = flattenStyle(
      renderer.root.findByProps({ testID: 'action-switch-secondary' }).props.style,
    );

    expect(primaryStyle.backgroundColor).toBe(ACTION_SWITCH_STYLE_TOKENS.color.keepBackground);
    expect(secondaryStyle.backgroundColor).toBeUndefined();
  });

  it('keeps the API-preserving visual contract in file-backed component tokens', () => {
    expect(ACTION_SWITCH_STYLE_TOKENS.color.dangerBackground).toBe('#d8646a');
    expect(ACTION_SWITCH_STYLE_TOKENS.color.keepBackground).toBe('#18bf63');
    expect(ACTION_SWITCH_STYLE_TOKENS.color.activeText).toBe('#ffffff');
    expect(ACTION_SWITCH_STYLE_TOKENS.radius.compact).toBe(16);
    expect(ACTION_SWITCH_STYLE_TOKENS.radius.regular).toBe(18);
    expect(ACTION_SWITCH_STYLE_TOKENS.gap.compact).toBe(4);
    expect(ACTION_SWITCH_STYLE_TOKENS.size.segmentMinWidthCompact).toBe(56);
    expect(ACTION_SWITCH_STYLE_TOKENS.typography.fontWeight).toBe('800');
  });

  it('renders shared icon glyphs when action icons are provided', () => {
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <ActionSwitch
          primaryLabel="保留"
          secondaryLabel="清除"
          primaryIcon="checkmark-circle-outline"
          secondaryIcon="trash-outline"
          onPrimaryPress={vi.fn()}
          onSecondaryPress={vi.fn()}
          selectedAction="secondary"
        />,
      );
    });

    expect(renderer.root.findByProps({ testID: 'action-switch-primary-icon' })).toBeTruthy();
    expect(renderer.root.findByProps({ testID: 'action-switch-secondary-icon' })).toBeTruthy();
  });
});
