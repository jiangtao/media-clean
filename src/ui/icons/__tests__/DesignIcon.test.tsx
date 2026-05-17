import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

import { DesignIcon, resolveDesignIconDimensions } from '../DesignIcon';

describe('DesignIcon', () => {
  it('renders explicit rectangular dimensions for the video icon', () => {
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <DesignIcon
          name="video"
          width={20}
          height={18}
          color="#ffffff"
          testID="video-icon"
        />,
      );
    });

    const svg = renderer.root.findByType('Svg');
    expect(svg.props.width).toBe(20);
    expect(svg.props.height).toBe(18);
    expect(svg.props.viewBox).toBe('0.889 2 22.222 20');
  });

  it('renders explicit square dimensions for existing 24 by 24 navigation icons', () => {
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <DesignIcon
          name="nav-photo"
          width={28}
          height={28}
          color="#2563EB"
          testID="nav-photo-icon"
        />,
      );
    });

    const svg = renderer.root.findByType('Svg');
    expect(svg.props.width).toBe(28);
    expect(svg.props.height).toBe(28);
    expect(svg.props.viewBox).toBe('1 1 22 22');
  });

  it('fits non-square icons into a square frame without distorting their aspect ratio', () => {
    expect(resolveDesignIconDimensions('check', { width: 24, height: 24 })).toEqual({
      width: 24,
      height: 24,
      glyphWidth: 18.286,
      glyphHeight: 24,
      viewBox: '3.238 1 17.524 23',
    });
    expect(resolveDesignIconDimensions('nav-trash', { width: 24, height: 24 })).toEqual({
      width: 24,
      height: 24,
      glyphWidth: 21.6,
      glyphHeight: 24,
      viewBox: '2.1 1 19.8 22',
    });
    expect(resolveDesignIconDimensions('video', { width: 24, height: 24 })).toEqual({
      width: 24,
      height: 24,
      glyphWidth: 24,
      glyphHeight: 21.6,
      viewBox: '0.889 2 22.222 20',
    });
  });

  it('uses the visible camera bounds as the default video aspect ratio', () => {
    expect(resolveDesignIconDimensions('video')).toEqual({
      width: 20,
      height: 18,
      glyphWidth: 20,
      glyphHeight: 18,
      viewBox: '0.889 2 22.222 20',
    });
    expect(resolveDesignIconDimensions('video', { width: 15 })).toMatchObject({
      width: 15,
      height: 13.5,
      glyphWidth: 15,
      glyphHeight: 13.5,
    });
  });
});
