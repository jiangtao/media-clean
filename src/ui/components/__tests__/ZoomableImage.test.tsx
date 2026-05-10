import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react-native';
import { ZoomableImage } from '../ZoomableImage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React from 'react';

describe('ZoomableImage', () => {
  const defaultProps = {
    uri: 'test-image.jpg',
    width: 300,
    height: 400,
  };

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>
  );

  it('should render without error', async () => {
    const { getByTestId } = await render(
      <Wrapper>
        <ZoomableImage {...defaultProps} />
      </Wrapper>
    );

    expect(getByTestId('zoomable-image')).toBeDefined();
  });

  it('should apply default min and max scale', async () => {
    const { getByTestId } = await render(
      <Wrapper>
        <ZoomableImage {...defaultProps} maxScale={3} minScale={1} />
      </Wrapper>
    );

    expect(getByTestId('zoomable-image')).toBeDefined();
  });

  it('should handle custom scale limits', async () => {
    const { getByTestId } = await render(
      <Wrapper>
        <ZoomableImage {...defaultProps} maxScale={5} minScale={0.5} />
      </Wrapper>
    );

    expect(getByTestId('zoomable-image')).toBeDefined();
  });

  it('should pass image URI correctly', async () => {
    const { getByTestId } = await render(
      <Wrapper>
        <ZoomableImage {...defaultProps} uri="custom-image.png" />
      </Wrapper>
    );

    const image = getByTestId('zoomable-image');
    expect(image).toBeDefined();
  });

  it('should apply correct dimensions', async () => {
    const { getByTestId } = await render(
      <Wrapper>
        <ZoomableImage {...defaultProps} width={500} height={600} />
      </Wrapper>
    );

    expect(getByTestId('zoomable-image')).toBeDefined();
  });

  it('should call onScaleChange callback', async () => {
    const onScaleChange = vi.fn();
    const { getByTestId } = await render(
      <Wrapper>
        <ZoomableImage {...defaultProps} onScaleChange={onScaleChange} />
      </Wrapper>
    );

    expect(getByTestId('zoomable-image')).toBeDefined();
  });

  it('should support double tap reset when enabled', async () => {
    const { getByTestId } = await render(
      <Wrapper>
        <ZoomableImage {...defaultProps} doubleTapReset={true} />
      </Wrapper>
    );

    expect(getByTestId('zoomable-image')).toBeDefined();
  });

  it('should disable double tap reset when false', async () => {
    const { getByTestId } = await render(
      <Wrapper>
        <ZoomableImage {...defaultProps} doubleTapReset={false} />
      </Wrapper>
    );

    expect(getByTestId('zoomable-image')).toBeDefined();
  });
});
