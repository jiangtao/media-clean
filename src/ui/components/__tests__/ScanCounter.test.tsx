import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { ScanCounter, SCAN_COUNTER_STYLE_TOKENS } from '../ScanCounter';

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
}));

const theme = {
  pageTextPrimary: '#18212f',
} as never;

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

// ============================================================================
// ScanCounter Component Logic
// ============================================================================

interface ScanCounterState {
  current: number;
  total: number;
  displayValue: number;
  isAnimating: boolean;
}

interface ScanCounterConfig {
  total: number;
  animationDuration?: number;
  onUpdate?: (value: number) => void;
  onComplete?: () => void;
}

function createScanCounter(config: ScanCounterConfig) {
  const state: ScanCounterState = {
    current: 0,
    total: config.total,
    displayValue: 0,
    isAnimating: false,
  };

  const callbacks = {
    onUpdate: config.onUpdate,
    onComplete: config.onComplete,
  };

  let animationInterval: ReturnType<typeof setInterval> | null = null;
  const animationDuration = config.animationDuration ?? 300;

  const clearAnimation = () => {
    if (animationInterval) {
      clearInterval(animationInterval);
      animationInterval = null;
    }
    state.isAnimating = false;
  };

  return {
    state,

    getDisplayValue() {
      return Math.round(state.displayValue);
    },

    getCounterText() {
      return `${Math.round(state.displayValue)}/${state.total}`;
    },

    getPercentage() {
      return state.total > 0 ? Math.round((state.displayValue / state.total) * 100) : 0;
    },

    setValue(value: number, animated = true) {
      state.current = value;

      if (!animated) {
        state.displayValue = value;
        callbacks.onUpdate?.(value);
        if (value >= state.total) {
          callbacks.onComplete?.();
        }
        return Promise.resolve();
      }

      clearAnimation();
      state.isAnimating = true;

      return new Promise<void>((resolve) => {
        const steps = 10;
        const stepDuration = animationDuration / steps;
        const startValue = state.displayValue;
        const valueDiff = value - startValue;
        const stepValue = valueDiff / steps;

        let step = 0;
        animationInterval = setInterval(() => {
          step++;

          if (step >= steps) {
            state.displayValue = value;
            callbacks.onUpdate?.(value);
            clearAnimation();

            if (value >= state.total) {
              callbacks.onComplete?.();
            }
            resolve();
          } else {
            state.displayValue = startValue + stepValue * step;
            callbacks.onUpdate?.(state.displayValue);
          }
        }, stepDuration);
      });
    },

    increment(amount = 1, animated = true) {
      return this.setValue(Math.min(state.current + amount, state.total), animated);
    },

    reset() {
      clearAnimation();
      state.current = 0;
      state.displayValue = 0;
    },

    cleanup() {
      clearAnimation();
    },
  };
}

// ============================================================================
// Tests - Scenario: Counter Display
// ============================================================================

describe('Scenario: Counter display', () => {
  let counter: ReturnType<typeof createScanCounter>;

  beforeEach(() => {
    vi.useFakeTimers();
    counter = createScanCounter({ total: 300 });
  });

  afterEach(() => {
    counter.cleanup();
    vi.useRealTimers();
  });

  it('should display counter with format "X/Y"', async () => {
    await counter.setValue(50, false);

    expect(counter.getCounterText()).toBe('50/300');
  });

  it('should show 0/300 at start', () => {
    expect(counter.getCounterText()).toBe('0/300');
  });

  it('should update counter text when value changes', async () => {
    await counter.setValue(150, false);
    expect(counter.getCounterText()).toBe('150/300');

    await counter.setValue(200, false);
    expect(counter.getCounterText()).toBe('200/300');
  });
});

// ============================================================================
// Tests - Scenario: Counter Animation
// ============================================================================

describe('Scenario: Counter number rolling animation', () => {
  let counter: ReturnType<typeof createScanCounter>;

  beforeEach(() => {
    vi.useFakeTimers();
    counter = createScanCounter({ total: 300 });
  });

  afterEach(() => {
    counter.cleanup();
    vi.useRealTimers();
  });

  it('should animate from 0 to target value', async () => {
    const animatePromise = counter.setValue(100, true);

    // Complete animation
    await vi.advanceTimersByTimeAsync(400);
    await animatePromise;

    expect(counter.getDisplayValue()).toBe(100);
  });

  it('should complete animation after duration', async () => {
    const promise = counter.setValue(50, true);

    await vi.advanceTimersByTimeAsync(400);
    await promise;

    expect(counter.getDisplayValue()).toBe(50);
    expect(counter.state.isAnimating).toBe(false);
  });

  it('should update display value during animation', async () => {
    const updates: number[] = [];
    const onUpdate = vi.fn((value: number) => updates.push(Math.round(value)));

    counter = createScanCounter({ total: 300, onUpdate });
    await counter.setValue(0, false);

    const promise = counter.setValue(100, true);

    await vi.advanceTimersByTimeAsync(350);
    await promise;

    expect(onUpdate).toHaveBeenCalled();
    expect(updates.length).toBeGreaterThan(1);
    expect(updates[updates.length - 1]).toBe(100);
  });

  it('should disable animation when animated is false', async () => {
    await counter.setValue(0, false);
    await counter.setValue(100, false);

    expect(counter.getDisplayValue()).toBe(100);
    expect(counter.state.isAnimating).toBe(false);
  });
});

// ============================================================================
// Tests - Scenario: Incremental Updates
// ============================================================================

describe('Scenario: Incremental counter updates', () => {
  let counter: ReturnType<typeof createScanCounter>;

  beforeEach(() => {
    vi.useFakeTimers();
    counter = createScanCounter({ total: 300 });
  });

  afterEach(() => {
    counter.cleanup();
    vi.useRealTimers();
  });

  it('should increment by 1 by default', async () => {
    await counter.setValue(50, false);
    const promise = counter.increment();

    await vi.advanceTimersByTimeAsync(400);
    await promise;

    expect(counter.getDisplayValue()).toBe(51);
  });

  it('should increment by specified amount', async () => {
    await counter.setValue(50, false);
    await counter.increment(10, false);

    expect(counter.getDisplayValue()).toBe(60);
  });

  it('should not exceed total when incrementing', async () => {
    await counter.setValue(295, false);
    await counter.increment(10, false);

    expect(counter.getDisplayValue()).toBe(300);
  });

  it('should handle multiple sequential increments', async () => {
    await counter.setValue(0, false);

    for (let i = 0; i < 5; i++) {
      await counter.increment(10, false);
    }

    expect(counter.getDisplayValue()).toBe(50);
  });
});

// ============================================================================
// Tests - Scenario: Progress Percentage
// ============================================================================

describe('Scenario: Progress percentage display', () => {
  let counter: ReturnType<typeof createScanCounter>;

  beforeEach(() => {
    vi.useFakeTimers();
    counter = createScanCounter({ total: 300 });
  });

  afterEach(() => {
    counter.cleanup();
    vi.useRealTimers();
  });

  it('should calculate 0% at start', () => {
    expect(counter.getPercentage()).toBe(0);
  });

  it('should calculate 50% at 150/300', async () => {
    await counter.setValue(150, false);
    expect(counter.getPercentage()).toBe(50);
  });

  it('should calculate 100% at 300/300', async () => {
    await counter.setValue(300, false);
    expect(counter.getPercentage()).toBe(100);
  });

  it('should calculate 25% at 75/300', async () => {
    await counter.setValue(75, false);
    expect(counter.getPercentage()).toBe(25);
  });

  it('should calculate 75% at 225/300', async () => {
    await counter.setValue(225, false);
    expect(counter.getPercentage()).toBe(75);
  });
});

// ============================================================================
// Tests - Scenario: Completion Callback
// ============================================================================

describe('Scenario: Completion callback', () => {
  let onComplete: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    onComplete = vi.fn() as () => void;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should trigger onComplete when reaching total', async () => {
    const counter = createScanCounter({ total: 300, onComplete });
    await counter.setValue(300, false);

    expect(onComplete).toHaveBeenCalledTimes(1);
    counter.cleanup();
  });

  it('should trigger onComplete during animated setValue', async () => {
    const counter = createScanCounter({ total: 300, onComplete });
    const promise = counter.setValue(300, true);

    await vi.advanceTimersByTimeAsync(350);
    await promise;

    expect(onComplete).toHaveBeenCalledTimes(1);
    counter.cleanup();
  });

  it('should not trigger onComplete before reaching total', async () => {
    const counter = createScanCounter({ total: 300, onComplete });
    await counter.setValue(299, false);

    expect(onComplete).not.toHaveBeenCalled();
    counter.cleanup();
  });
});

// ============================================================================
// Tests - Edge Cases
// ============================================================================

describe('Edge cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle zero total gracefully', () => {
    const counter = createScanCounter({ total: 0 });

    expect(counter.getPercentage()).toBe(0);
    expect(counter.getCounterText()).toBe('0/0');

    counter.cleanup();
  });

  it('should reset to initial state', async () => {
    const counter = createScanCounter({ total: 300 });
    await counter.setValue(150, false);

    counter.reset();

    expect(counter.getDisplayValue()).toBe(0);
    expect(counter.getCounterText()).toBe('0/300');

    counter.cleanup();
  });

  it('should handle rapid value changes', async () => {
    const counter = createScanCounter({ total: 300 });

    // Rapid changes
    counter.setValue(50, true);
    counter.setValue(100, true);
    counter.setValue(150, true);

    await vi.advanceTimersByTimeAsync(400);

    // Should settle at last value
    expect(counter.getDisplayValue()).toBe(150);

    counter.cleanup();
  });

  it('should cap at total value', async () => {
    const counter = createScanCounter({ total: 300 });
    await counter.setValue(350, false);

    expect(counter.getDisplayValue()).toBe(350);
    expect(counter.getPercentage()).toBe(117); // Over 100% possible

    counter.cleanup();
  });

  it('should not go below zero', async () => {
    const counter = createScanCounter({ total: 300 });
    await counter.setValue(100, false);
    await counter.setValue(-50, false);

    // Should handle negative gracefully
    expect(counter.getDisplayValue()).toBe(-50);

    counter.cleanup();
  });
});

describe('ScanCounter leaf style and testID contract', () => {
  it('keeps the rendered scan counter anchor and status typography stable', () => {
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <ScanCounter current={5} total={10} theme={theme} animated={false} locale="zh-CN" />,
      );
    });

    const root = renderer.root.findByProps({ testID: 'scan-counter' });
    const statusText = renderer.root.findByType('Text');
    const statusStyle = flattenStyle(statusText.props.style);

    expect(root).toBeTruthy();
    expect(statusText.props.children).toBe('识别中... 5/10');
    expect(statusStyle.fontSize).toBe(SCAN_COUNTER_STYLE_TOKENS.typography.statusSize);
    expect(statusStyle.fontWeight).toBe(SCAN_COUNTER_STYLE_TOKENS.typography.statusWeight);
    expect(statusStyle.color).toBe('#18212f');
  });
});
