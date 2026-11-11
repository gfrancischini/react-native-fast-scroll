import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { FastScrollIndicator } from '../../index';
import {
  drag,
  getPanCallbacks,
  layoutPanArea,
  touchDown,
} from '../../__fixtures__/gestures';
import { whileJsThreadIsBusy } from '../../__fixtures__/jsThread';
import { getThumbPosition } from '../../__fixtures__/positions';

jest.mock('react-native-reanimated', () =>
  require('../../__fixtures__/jsThread').reanimatedWithJsThread()
);

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

  return { scrollListTo, scrollToOffsetPercentage, unmount: screen.unmount };
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

  it('leaves no hide timer running once it unmounts while shown', () => {
    // An app screen that closes while the bar is on screen.
    const { scrollListTo, unmount } = renderIndicator({
      hideFastScrollIndicatorTimeout: 2000,
    });
    scrollListTo(0.3);
    act(() => jest.advanceTimersByTime(1000));

    unmount();
    // Let the bar's 500 ms exit animation, which runs on Reanimated's own
    // timers, finish; the hide timeout is still 500 ms away.
    act(() => jest.advanceTimersByTime(500));

    expect(jest.getTimerCount()).toBe(0);
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

  // An iOS list bounces past either end: from the middle, one scroll frame can
  // already report an offset beyond the end it is flung to.
  it.each([
    [-0.1, 0],
    [1.1, 500],
  ])(
    'pins the thumb to the end of the track when the list overscrolls to %p',
    (offset, thumbPosition) => {
      const { scrollListTo } = renderIndicator({
        hideFastScrollIndicatorTimeout: 1000,
      });
      scrollListTo(0.5);
      act(() => jest.advanceTimersByTime(800));

      scrollListTo(offset);

      expect(getThumbPosition()).toBe(thumbPosition);
      act(() => jest.advanceTimersByTime(800));
      expect(isScrollBarShown()).toBe(true);
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

  it('jumps the list to the point of the track the finger touches', () => {
    const { scrollToOffsetPercentage } = renderIndicator();

    const finger = touchDown(275);
    expect(scrollToOffsetPercentage.mock.calls).toEqual([[0.5]]);

    finger.lift();
    expect(scrollToOffsetPercentage).toHaveBeenLastCalledWith(0.5);
  });

  it('scrolls the list to the share of the track the thumb is dragged to', () => {
    const { scrollToOffsetPercentage } = renderIndicator();
    const finger = touchDown(25);
    expect(scrollToOffsetPercentage).toHaveBeenLastCalledWith(0);

    finger.moveTo(275);
    expect(scrollToOffsetPercentage).toHaveBeenLastCalledWith(0.5);

    finger.moveTo(525);
    expect(scrollToOffsetPercentage).toHaveBeenLastCalledWith(1);
  });

  it('clamps a drag beyond either end of the track to the start or the end of the list', () => {
    const { scrollToOffsetPercentage } = renderIndicator();

    const finger = touchDown(-100);
    expect(scrollToOffsetPercentage).toHaveBeenLastCalledWith(0);

    finger.moveTo(900);
    expect(scrollToOffsetPercentage).toHaveBeenLastCalledWith(1);
  });

  it('keeps the thumb under the finger and the bar on screen while the finger is down', () => {
    const { scrollListTo } = renderIndicator({
      hideFastScrollIndicatorTimeout: 1000,
    });
    scrollListTo(0.1);

    touchDown(275);
    // The list scrolls in response and keeps reporting its (lagging) offset.
    scrollListTo(0.2);
    act(() => jest.advanceTimersByTime(5000));

    expect(getThumbPosition()).toBe(250);
    expect(isScrollBarShown()).toBe(true);
  });

  it('hides the bar once the timeout elapses after the finger lifts', () => {
    const { scrollListTo } = renderIndicator({
      hideFastScrollIndicatorTimeout: 1000,
    });
    scrollListTo(0.1);
    const finger = touchDown(275);
    finger.moveTo(400);
    act(() => jest.advanceTimersByTime(5000));

    finger.lift();

    act(() => jest.advanceTimersByTime(999));
    expect(isScrollBarShown()).toBe(true);
    act(() => jest.advanceTimersByTime(1));
    expect(isScrollBarShown()).toBe(false);
  });

  // On a device the pan tells the JS thread that a finger is down through
  // runOnJS, behind the list's scroll events already in line there, as when
  // the finger catches a list that is still flinging.
  it('keeps the thumb under the finger when the list reports its old offset as the finger lands', () => {
    const { scrollListTo } = renderIndicator({
      hideFastScrollIndicatorTimeout: 1000,
    });
    scrollListTo(0.1);

    whileJsThreadIsBusy(() => {
      touchDown(275);
      scrollListTo(0.2);
    });
    act(() => jest.advanceTimersByTime(5000));

    expect(getThumbPosition()).toBe(250);
    expect(isScrollBarShown()).toBe(true);
  });

  // The other end of the touch: the pan tells the JS thread that the finger
  // lifted behind the list's scroll events of the drag, which report where the
  // finger was a few frames before.
  it('keeps the thumb where the finger lifts when the list reports an earlier offset of the drag', () => {
    const { scrollListTo } = renderIndicator();
    scrollListTo(0.1);
    const finger = touchDown(275);
    finger.moveTo(400);

    whileJsThreadIsBusy(() => {
      finger.lift();
      scrollListTo(0.5);
    });

    // The thumb's top at the finger: 400 - 25.
    expect(getThumbPosition()).toBe(375);
  });

  it('follows the list again once the finger lifts', () => {
    const { scrollListTo } = renderIndicator();
    scrollListTo(0.1);
    drag([275, 400]);

    scrollListTo(0.2);

    expect(getThumbPosition()).toBe(100);
  });

  // Apps usually pass a new inline scrollToOffsetPercentage on every render.
  it('scrolls the list with the scrollToOffsetPercentage of the latest render', () => {
    const firstScrollTo = jest.fn();
    const latestScrollTo = jest.fn();
    const { rerender } = render(
      <FastScrollIndicator
        thumbSize={THUMB}
        scrollToOffsetPercentage={firstScrollTo}
      />
    );
    layoutPanArea(TRACK_HEIGHT);
    rerender(
      <FastScrollIndicator
        thumbSize={THUMB}
        scrollToOffsetPercentage={latestScrollTo}
      />
    );

    drag([25, 275]);

    expect(latestScrollTo).toHaveBeenLastCalledWith(0.5);
    expect(firstScrollTo).not.toHaveBeenCalled();
  });

  it('hides the bar after the hideFastScrollIndicatorTimeout of the latest render once the finger lifts', () => {
    const ref = React.createRef<React.ElementRef<typeof FastScrollIndicator>>();
    const scrollToOffsetPercentage = jest.fn();
    const { rerender } = render(
      <FastScrollIndicator
        ref={ref}
        thumbSize={THUMB}
        scrollToOffsetPercentage={scrollToOffsetPercentage}
        hideFastScrollIndicatorTimeout={1000}
      />
    );
    layoutPanArea(TRACK_HEIGHT);
    rerender(
      <FastScrollIndicator
        ref={ref}
        thumbSize={THUMB}
        scrollToOffsetPercentage={scrollToOffsetPercentage}
        hideFastScrollIndicatorTimeout={3000}
      />
    );
    act(() => ref.current?.onScrollToOffsetPercentage(0.1));

    drag([25, 275]);

    act(() => jest.advanceTimersByTime(2999));
    expect(isScrollBarShown()).toBe(true);
    act(() => jest.advanceTimersByTime(1));
    expect(isScrollBarShown()).toBe(false);
  });

  // On a device, each rebuilt pan gesture hands Reanimated new worklets, and
  // Reanimated holds the JS functions they call from native code. A pan
  // rebuilt on every render kept every render of the app's screen alive
  // through the callbacks those functions closed over, so closed screens
  // piled up in memory. Jest cannot measure that leak; keeping the pan's
  // callbacks the same objects is what prevents it.
  it('keeps the same pan callbacks while the app passes new props on every render', () => {
    // A new inline callback each time, as an app's render creates one.
    const indicatorWith = (hideFastScrollIndicatorTimeout: number) => (
      <FastScrollIndicator
        thumbSize={THUMB}
        scrollToOffsetPercentage={(offsetPercentage) => offsetPercentage}
        hideFastScrollIndicatorTimeout={hideFastScrollIndicatorTimeout}
      />
    );
    const { rerender } = render(indicatorWith(1000));
    const callbacks = getPanCallbacks();

    rerender(indicatorWith(1000));
    rerender(indicatorWith(3000));

    expect(getPanCallbacks()).toBe(callbacks);
  });

  // Today the hidden track still takes the drag and scrolls the list, but the
  // bar stays hidden for the whole drag: the list's own scroll events, which
  // would show it, are ignored while the finger is down.
  it.todo('shows the bar when a finger drags the hidden track');
});
