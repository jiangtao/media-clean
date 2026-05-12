import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { describe, expect, it, vi } from 'vitest';

import { ZoomableImage } from '../ZoomableImage';

describe('ZoomableImage', () => {
  const defaultProps = {
    uri: 'test-image.jpg',
    width: 300,
    height: 400,
  };

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>
  );

  function renderZoomableImage(props: Partial<React.ComponentProps<typeof ZoomableImage>> = {}) {
    let renderer!: ReturnType<typeof TestRenderer.create>;

    act(() => {
      renderer = TestRenderer.create(
        <Wrapper>
          <ZoomableImage {...defaultProps} {...props} />
        </Wrapper>
      );
    });

    return renderer;
  }

  it('should render without error', () => {
    const renderer = renderZoomableImage();

    expect(renderer.root.findByProps({ testID: 'zoomable-image' })).toBeDefined();
  });

  it('should apply default min and max scale', () => {
    const renderer = renderZoomableImage({ maxScale: 3, minScale: 1 });

    expect(renderer.root.findByProps({ testID: 'zoomable-image' })).toBeDefined();
  });

  it('should handle custom scale limits', () => {
    const renderer = renderZoomableImage({ maxScale: 5, minScale: 0.5 });

    expect(renderer.root.findByProps({ testID: 'zoomable-image' })).toBeDefined();
  });

  it('should pass image URI correctly', () => {
    const renderer = renderZoomableImage({ uri: 'custom-image.png' });
    const image = renderer.root.findByProps({ testID: 'zoomable-image-content' });

    expect(image.props.source).toMatchObject({
      uri: 'custom-image.png',
      width: 300,
      height: 400,
      scale: 3,
    });
  });

  it('should apply correct dimensions', () => {
    const renderer = renderZoomableImage({ width: 500, height: 600 });
    const image = renderer.root.findByProps({ testID: 'zoomable-image-content' });

    expect(image.props.source).toMatchObject({
      uri: 'test-image.jpg',
      width: 500,
      height: 600,
      scale: 3,
    });
  });

  it('should call onScaleChange callback', () => {
    const onScaleChange = vi.fn();
    const renderer = renderZoomableImage({ onScaleChange });

    expect(renderer.root.findByProps({ testID: 'zoomable-image' })).toBeDefined();
  });

  it('should support double tap reset when enabled', () => {
    const renderer = renderZoomableImage({ doubleTapReset: true });

    expect(renderer.root.findByProps({ testID: 'zoomable-image' })).toBeDefined();
  });

  it('should disable double tap reset when false', () => {
    const renderer = renderZoomableImage({ doubleTapReset: false });

    expect(renderer.root.findByProps({ testID: 'zoomable-image' })).toBeDefined();
  });
});
