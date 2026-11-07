import React from 'react';
import { ScrollView, Text } from 'react-native';
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { FastScrollSectionDots, Section } from '../../index';
import { dragThroughPositions } from '../../__fixtures__/gestures';
import { getThumbPosition } from '../../__fixtures__/thumb';

type SectionLabel = Exclude<Section['text'], string>;

/** A section label that says whether the section list marks it active. */
const activeAwareLabel = (name: string): SectionLabel =>
  function ActiveAwareLabel({ isActive }) {
    return <Text>{isActive ? `${name} (active)` : name}</Text>;
  };

// With the default 10px dots and 12px margins, dot n starts at
// y = 12(n + 1) + 10n: 12, 34 and 56. A finger picks the section whose dot
// starts nearest to it, so a finger at these heights picks:
const FINGER_ON = { fruits: 5, vegetables: 40, dairy: 61 };

// ...and the thumb sits on the middle of a dot, 5px further down.
const THUMB_ON = { fruits: 17, vegetables: 39, dairy: 61 };

const SECTIONS: Section[] = [
  { index: 0, text: 'Fruits' },
  { index: 5, text: 'Vegetables' },
  { index: 9, text: 'Dairy' },
];

const renderDots = ({
  sections = SECTIONS,
  hideFastScrollIndicatorTimeout,
}: {
  sections?: Section[];
  hideFastScrollIndicatorTimeout?: number;
} = {}) => {
  const ref = React.createRef<React.ElementRef<typeof FastScrollSectionDots>>();
  const onScrollToIndex = jest.fn();
  render(
    <FastScrollSectionDots
      ref={ref}
      stickyHeaderIndicesWithData={sections}
      hideFastScrollIndicatorTimeout={hideFastScrollIndicatorTimeout}
      onScrollToIndex={onScrollToIndex}
    />
  );

  const scrollList = () =>
    act(() => ref.current?.onScrollToOffsetPercentage(0.5));

  const showListItem = (index: number) =>
    act(() => ref.current?.onViewableIndexChanged(index));

  return { onScrollToIndex, scrollList, showListItem };
};

/**
 * The section list's ScrollView. The list exposes no other handle, so this is
 * the documented `UNSAFE_*` exception (docs/unit-testing.md -> Mocks the RN
 * preset already provides).
 */
const getSectionListScrollView = () => screen.UNSAFE_getByType(ScrollView);

/**
 * Lays the open section list out the way the native layout pass would:
 * `visibleHeight` of it on screen, one `rowHeight` row per section, in order.
 */
const layoutSectionList = ({
  visibleHeight,
  rowHeight,
}: {
  visibleHeight: number;
  rowHeight: number;
}) => {
  const layout = (y: number, height: number) => ({
    nativeEvent: { layout: { x: 0, y, width: 100, height } },
  });
  fireEvent(getSectionListScrollView(), 'layout', layout(0, visibleHeight));
  SECTIONS.forEach(({ text }, i) =>
    fireEvent(
      screen.getByText(String(text)),
      'layout',
      layout(i * rowHeight, rowHeight)
    )
  );
};

/** Nothing is on screen when the container holds neither the dots nor the list. */
const isAnythingShown = () => {
  const tree = screen.toJSON();
  return tree != null && !Array.isArray(tree) && tree.children != null;
};

describe('FastScrollSectionDots', () => {
  beforeEach(() => jest.useFakeTimers());

  it('renders nothing for a list without sections', () => {
    renderDots({ sections: [], hideFastScrollIndicatorTimeout: 0 });

    expect(screen.toJSON()).toBeNull();
  });

  it('appears when the list scrolls and disappears once the timeout elapses', () => {
    const { scrollList } = renderDots({ hideFastScrollIndicatorTimeout: 1000 });
    expect(isAnythingShown()).toBe(false);

    scrollList();
    expect(isAnythingShown()).toBe(true);

    act(() => jest.advanceTimersByTime(999));
    expect(isAnythingShown()).toBe(true);
    act(() => jest.advanceTimersByTime(1));
    expect(isAnythingShown()).toBe(false);
  });

  it('is always on screen when hideFastScrollIndicatorTimeout is 0', () => {
    renderDots({ hideFastScrollIndicatorTimeout: 0 });

    act(() => jest.advanceTimersByTime(60_000));

    expect(isAnythingShown()).toBe(true);
  });

  it('moves the thumb to the dot of the section that holds the first visible item', () => {
    const { showListItem } = renderDots({ hideFastScrollIndicatorTimeout: 0 });

    showListItem(7);
    expect(getThumbPosition()).toBe(THUMB_ON.vegetables);

    showListItem(250);
    expect(getThumbPosition()).toBe(THUMB_ON.dairy);

    showListItem(0);
    expect(getThumbPosition()).toBe(THUMB_ON.fruits);
  });

  // Today the dots remount when they reappear and the thumb starts at the top
  // of the bar (above the first dot) until the next onViewableIndexChanged.
  // Calls made while the dots are hidden are dropped as well.
  it.todo('shows the thumb on the current section when the dots reappear');

  it('opens the section list with the dragged section marked active', () => {
    renderDots({
      hideFastScrollIndicatorTimeout: 0,
      sections: [
        { index: 0, text: activeAwareLabel('Fruits') },
        { index: 5, text: activeAwareLabel('Vegetables') },
        { index: 9, text: activeAwareLabel('Dairy') },
      ],
    });
    expect(screen.queryByText('Fruits')).not.toBeOnTheScreen();

    dragThroughPositions([FINGER_ON.vegetables]);

    expect(screen.getByText('Fruits')).toBeOnTheScreen();
    expect(screen.getByText('Vegetables (active)')).toBeOnTheScreen();
    expect(screen.getByText('Dairy')).toBeOnTheScreen();
  });

  it('scrolls the list to the header of the last dragged section once the drag settles', () => {
    const { onScrollToIndex } = renderDots({
      hideFastScrollIndicatorTimeout: 0,
    });

    dragThroughPositions([
      FINGER_ON.fruits,
      FINGER_ON.vegetables,
      FINGER_ON.dairy,
    ]);
    act(() => jest.advanceTimersByTime(999));
    expect(onScrollToIndex).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(1));
    expect(onScrollToIndex.mock.calls).toEqual([[9]]);
  });

  it('scrolls the list to the first item of a section tapped in the section list', async () => {
    const user = userEvent.setup();
    const { onScrollToIndex } = renderDots({
      hideFastScrollIndicatorTimeout: 0,
    });
    dragThroughPositions([FINGER_ON.fruits]);
    act(() => jest.advanceTimersByTime(1000));

    await user.press(screen.getByText('Dairy'));

    expect(onScrollToIndex).toHaveBeenLastCalledWith(10);
    expect(screen.queryByText('Dairy')).not.toBeOnTheScreen();
  });

  // Today a tap within 1 s of the drag scrolls to the tapped section, then the
  // pending debounced call scrolls back to the dragged section's header.
  it.todo(
    'stays on the tapped section when it is tapped before the drag settles'
  );

  it('keeps the dots on screen while the section list is open and hides both afterwards', () => {
    const { scrollList } = renderDots({ hideFastScrollIndicatorTimeout: 1000 });
    scrollList();
    dragThroughPositions([FINGER_ON.vegetables]);

    // The section list closes itself after 3 s without interaction; until then
    // the dots ignore their own 1 s timeout.
    act(() => jest.advanceTimersByTime(2999));
    expect(screen.getByText('Vegetables')).toBeOnTheScreen();

    act(() => jest.advanceTimersByTime(1));
    expect(screen.queryByText('Vegetables')).not.toBeOnTheScreen();
    expect(isAnythingShown()).toBe(true);

    act(() => jest.advanceTimersByTime(1000));
    expect(isAnythingShown()).toBe(false);
  });

  it('keeps the section list open while the user scrolls through it', () => {
    renderDots({ hideFastScrollIndicatorTimeout: 0 });
    dragThroughPositions([FINGER_ON.fruits]);
    act(() => jest.advanceTimersByTime(2000));

    fireEvent.scroll(screen.getByText('Dairy'), {
      nativeEvent: {
        contentOffset: { x: 0, y: 20 },
        contentSize: { width: 100, height: 90 },
        layoutMeasurement: { width: 100, height: 40 },
      },
    });

    act(() => jest.advanceTimersByTime(2999));
    expect(screen.getByText('Dairy')).toBeOnTheScreen();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.queryByText('Dairy')).not.toBeOnTheScreen();
  });

  it('scrolls the open section list to center the section under the finger, and again a second later', () => {
    renderDots({ hideFastScrollIndicatorTimeout: 0 });
    dragThroughPositions([FINGER_ON.fruits]);
    layoutSectionList({ visibleHeight: 40, rowHeight: 30 });
    const scrollTo: jest.Mock = getSectionListScrollView().instance.scrollTo;

    dragThroughPositions([FINGER_ON.dairy]);

    // Dairy's row spans 60..90; centered in a 40px list, the list shows 55..95.
    expect(scrollTo.mock.calls).toEqual([[{ y: 55 }]]);

    // The retry covers rows that were not measured yet on the first attempt.
    act(() => jest.advanceTimersByTime(999));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(1));
    expect(scrollTo.mock.calls).toEqual([[{ y: 55 }], [{ y: 55 }]]);
  });
});
