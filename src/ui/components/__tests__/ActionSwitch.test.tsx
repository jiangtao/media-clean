import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { ActionSwitch } from '../ActionSwitch';

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
          primaryLabel="清除"
          secondaryLabel="保留"
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

  it('highlights the recommended keep action when the secondary side is selected', () => {
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <ActionSwitch
          primaryLabel="清除"
          secondaryLabel="保留"
          onPrimaryPress={vi.fn()}
          onSecondaryPress={vi.fn()}
          primaryTone="danger"
          secondaryTone="keep"
          selectedAction="secondary"
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
    expect(secondaryStyle.backgroundColor).toBe('#18bf63');
  });

  it('renders shared icon glyphs when action icons are provided', () => {
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <ActionSwitch
          primaryLabel="清除"
          secondaryLabel="保留"
          primaryIcon="trash-outline"
          secondaryIcon="checkmark-circle-outline"
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
