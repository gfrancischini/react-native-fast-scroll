import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { FastScrollIndicator } from '../../index';
import {
  dragThroughPositions,
  layoutPanArea,
} from '../../__fixtures__/gestures';
import { getThumbPosition } from '../../__fixtures__/thumb';

// A 50px thumb on a 550px track: its center travels from y=25 to y=525.
const THUMB = { width: 7, height: 50, borderRadius: 7 };
const TRACK_HEIGHT = 550;

const renderIndicator = ({
  hideFastScrollIndicatorTimeout,
}: {
  hideFastScrollIndicatorTimeout?: number;
} = {}) => {
  const ref = React.createRef<React.ElementRef<typeof FastScrollIndicator>>();
  const scrollToOffsetPercentage = jest.fn();
  render(
    <FastScrollIndicator
      ref={ref}
      thumbSize={THUMB}
      scrollToOffsetPercentage={scrollToOffsetPercentage}
      hideFastScrollIndicatorTimeout={hideFastScrollIndicatorTimeout}
    />
  );
  layoutPanArea(TRACK_HEIGHT);

  const scrollListTo = (offsetPercentage: number) =>
    act(() => ref.current?.onScrollToOffsetPercentage(offsetPercentage));

  return { scrollListTo, scrollToOffsetPercentage };
};

/** The gesture area stays mounted; the scroll bar is its only child. */
const isScrollBarShown = () => {
  const tree = screen.toJSON();
  return tree != null && !Array.isArray(tree) && tree.children != null;
};

describe('FastScrollIndicator', () => {
  beforeEach(() => jest.useFakeTimers());

  it('appears when the list scrolls and disappears once the timeout elapses', () => {
    const { scrollListTo } = renderIndicator({
      hideFastScrollIndicatorTimeout: 1000,
    });
    expect(isScrollBarShown()).toBe(false);

    scrollListTo(0.3);
    expect(isScrollBarShown()).toBe(true);

    act(() => jest.advanceTimersByTime(999));
    expect(isScrollBarShown()).toBe(true);
    act(() => jest.advanceTimersByTime(1));
    expect(isScrollBarShown()).toBe(false);
  });

  it('stays on screen while the list keeps scrolling', () => {
    const { scrollListTo } = renderIndicator({
      hideFastScrollIndicatorTimeout: 1000,
    });

    scrollListTo(0.1);
    act(() => jest.advanceTimersByTime(800));
    scrollListTo(0.2);
    act(() => jest.advanceTimersByTime(800));
    expect(isScrollBarShown()).toBe(true);

    act(() => jest.advanceTimersByTime(200));
    expect(isScrollBarShown()).toBe(false);
  });

  it('uses a 2 second timeout by default', () => {
    const { scrollListTo } = renderIndicator();

    scrollListTo(0.5);
    act(() => jest.advanceTimersByTime(1999));
    expect(isScrollBarShown()).toBe(true);

    act(() => jest.advanceTimersByTime(1));
    expect(isScrollBarShown()).toBe(false);
  });

  it('is always on screen when hideFastScrollIndicatorTimeout is 0', () => {
    renderIndicator({ hideFastScrollIndicatorTimeout: 0 });
    expect(isScrollBarShown()).toBe(true);

    act(() => jest.advanceTimersByTime(60_000));
    expect(isScrollBarShown()).toBe(true);
  });

  it.each([-0.1, 1.1])(
    'ignores a scroll offset of %p outside the 0..1 range',
    (offset) => {
      const { scrollListTo } = renderIndicator();

      scrollListTo(offset);

      expect(isScrollBarShown()).toBe(false);
    }
  );

  it('moves the thumb along the track as the list scrolls', () => {
    const { scrollListTo } = renderIndicator();

    // The thumb's top travels over the track minus its own height: 0..500.
    scrollListTo(0.5);
    expect(getThumbPosition()).toBe(250);

    scrollListTo(1);
    expect(getThumbPosition()).toBe(500);
  });

  it('ignores the list while the thumb is dragged, so the thumb stays under the finger', () => {
    const { scrollListTo } = renderIndicator({
      hideFastScrollIndicatorTimeout: 1000,
    });
    scrollListTo(0.1);

    dragThroughPositions([275]);
    // The list scrolls in response and keeps reporting its (lagging) offset.
    scrollListTo(0.2);
    act(() => jest.advanceTimersByTime(5000));

    expect(getThumbPosition()).toBe(250);
    expect(isScrollBarShown()).toBe(true);
  });

  it('scrolls the list to the share of the track the thumb is dragged to', () => {
    const { scrollToOffsetPercentage } = renderIndicator({
      hideFastScrollIndicatorTimeout: 0,
    });

    dragThroughPositions([25, 275, 525]);

    expect(scrollToOffsetPercentage.mock.calls).toEqual([[0], [0.5], [1]]);
  });

  it('clamps a drag beyond either end of the track to the start or the end of the list', () => {
    const { scrollToOffsetPercentage } = renderIndicator({
      hideFastScrollIndicatorTimeout: 0,
    });

    dragThroughPositions([-100, 900]);

    expect(scrollToOffsetPercentage.mock.calls).toEqual([[0], [1]]);
  });
});
