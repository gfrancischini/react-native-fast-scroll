import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { State, TapGesture } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils';
import { FastScrollSectionDots, Section, SectionTextProps } from '../../index';
import { drag, getPanArea, touchDown } from '../../__fixtures__/gestures';
import {
  getDotsScrollOffset,
  getThumbPosition,
} from '../../__fixtures__/positions';

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

// ...and once settled, the thumb sits on the middle of a dot, 5px further down.
const THUMB_ON = { fruits: 17, vegetables: 39, dairy: 61 };

// While a finger drags it, the thumb tracks the finger half a dot above it.
const THUMB_UNDER_FINGER_AT = (y: number) => y - 5;

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

/**
 * Lays the dots bar out at `height`, as the native layout pass would. The bar
 * reads its size with `measure()`, which RN's Jest preset mocks with a
 * `jest.fn()` shared by every View that never calls back; this makes it answer
 * once, then resets it so nothing leaks into later layouts.
 */
const layoutDotsBar = (height: number) => {
  const measure = jest.mocked(View.prototype.measure);
  measure.mockImplementationOnce((callback) =>
    callback(0, 0, 20, height, 0, 0)
  );
  fireEvent(getPanArea(), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 20, height } },
  });
  expect(measure).toHaveBeenCalledTimes(1);
  measure.mockReset();
};

/** Each section's position among SECTIONS, which names its row in the section list. */
const SECTION = { fruits: 0, vegetables: 1, dairy: 2 };

/**
 * The tap gesture of a row in the open section list. Rows react to an RNGH
 * tap, not a press, so they are driven with RNGH's jest utils
 * (docs/unit-testing.md -> Gestures).
 */
const getSectionListRowTap = (sectionIndex: number) =>
  getByGestureTestId(`fast-scroll-section-list-row-${sectionIndex}`);

/** A finger lands on a row and lifts without moving: the tap succeeds. */
const tapSectionListRow = (sectionIndex: number) =>
  act(() =>
    fireGestureHandler<TapGesture>(getSectionListRowTap(sectionIndex), [
      { state: State.BEGAN },
      { state: State.ACTIVE },
      { state: State.END },
    ])
  );

/** A finger lands on a row but the tap ends in `finalState` instead of succeeding. */
const touchSectionListRow = (
  sectionIndex: number,
  finalState: typeof State.FAILED | typeof State.CANCELLED
) =>
  act(() =>
    fireGestureHandler<TapGesture>(getSectionListRowTap(sectionIndex), [
      { state: State.BEGAN },
      { state: finalState },
    ])
  );

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

  it('lets the thumb follow the finger, then snaps it to the nearest dot when the finger lifts', () => {
    const { onScrollToIndex } = renderDots({
      hideFastScrollIndicatorTimeout: 0,
    });
    const finger = touchDown(FINGER_ON.fruits);

    // Between the first two dots, nearer the second.
    finger.moveTo(30);
    expect(getThumbPosition()).toBe(THUMB_UNDER_FINGER_AT(30));

    finger.lift();
    expect(getThumbPosition()).toBe(THUMB_ON.vegetables);
    act(() => jest.advanceTimersByTime(1000));
    expect(onScrollToIndex).toHaveBeenLastCalledWith(5);
  });

  it('keeps the thumb under the finger while the list reports its position, and follows the list again once the finger lifts', () => {
    const { showListItem } = renderDots({ hideFastScrollIndicatorTimeout: 0 });
    const finger = touchDown(FINGER_ON.fruits);
    finger.moveTo(FINGER_ON.dairy);

    // The list scrolls in response and reports where it currently is.
    showListItem(0);
    expect(getThumbPosition()).toBe(THUMB_UNDER_FINGER_AT(FINGER_ON.dairy));

    finger.lift();
    showListItem(0);
    expect(getThumbPosition()).toBe(THUMB_ON.fruits);
  });

  it('scrolls its dots to keep the active one in view when they do not all fit', () => {
    const { showListItem } = renderDots({
      hideFastScrollIndicatorTimeout: 0,
      sections: Array.from({ length: 30 }, (_, i) => ({
        index: i * 10,
        text: `Aisle ${i}`,
      })),
    });
    layoutDotsBar(300);

    // Aisle 25's dot is centered at 12 * 26 + 10 * 25 + 5 = 567. The bar
    // scrolls it to ten dots (100px) above its bottom edge: 300 - 100 - 567.
    showListItem(250);
    expect(getDotsScrollOffset()).toBe(-367);

    showListItem(0);
    expect(getDotsScrollOffset()).toBe(0);
  });

  it('keeps its dots still when they all fit', () => {
    const { showListItem } = renderDots({ hideFastScrollIndicatorTimeout: 0 });
    layoutDotsBar(300);

    showListItem(9);

    expect(getDotsScrollOffset()).toBe(0);
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

    touchDown(FINGER_ON.fruits).moveTo(FINGER_ON.vegetables);

    expect(screen.getByText('Fruits')).toBeOnTheScreen();
    expect(screen.getByText('Vegetables (active)')).toBeOnTheScreen();
    expect(screen.getByText('Dairy')).toBeOnTheScreen();
  });

  it('renders a section label wrapped in React.memo in the section list', () => {
    const AisleLabel = React.memo(function AisleLabel({
      section,
      isActive,
    }: SectionTextProps) {
      const name = `Aisle ${section.sectionIndex}`;
      return <Text>{isActive ? `${name} (active)` : name}</Text>;
    });
    renderDots({
      hideFastScrollIndicatorTimeout: 0,
      sections: [
        { index: 0, text: AisleLabel },
        { index: 5, text: AisleLabel },
      ],
    });

    touchDown(FINGER_ON.fruits);

    expect(screen.getByText('Aisle 0 (active)')).toBeOnTheScreen();
    expect(screen.getByText('Aisle 1')).toBeOnTheScreen();
  });

  it('scrolls the list to the header of the last dragged section once the drag settles', () => {
    const { onScrollToIndex } = renderDots({
      hideFastScrollIndicatorTimeout: 0,
    });

    drag([FINGER_ON.fruits, FINGER_ON.vegetables, FINGER_ON.dairy]);
    act(() => jest.advanceTimersByTime(999));
    expect(onScrollToIndex).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(1));
    expect(onScrollToIndex.mock.calls).toEqual([[9]]);
  });

  // Apps rebuild onScrollToIndex when what it reads changes, e.g. the height of
  // a header drawn over the list that it passes as viewOffset.
  it('scrolls with the onScrollToIndex of the latest render once the drag settles', () => {
    const firstOnScrollToIndex = jest.fn();
    const latestOnScrollToIndex = jest.fn();
    const { rerender } = render(
      <FastScrollSectionDots
        stickyHeaderIndicesWithData={SECTIONS}
        hideFastScrollIndicatorTimeout={0}
        onScrollToIndex={firstOnScrollToIndex}
      />
    );
    rerender(
      <FastScrollSectionDots
        stickyHeaderIndicesWithData={SECTIONS}
        hideFastScrollIndicatorTimeout={0}
        onScrollToIndex={latestOnScrollToIndex}
      />
    );

    drag([FINGER_ON.fruits, FINGER_ON.dairy]);
    act(() => jest.advanceTimersByTime(1000));

    expect(latestOnScrollToIndex.mock.calls).toEqual([[9]]);
    expect(firstOnScrollToIndex).not.toHaveBeenCalled();
  });

  it('scrolls with the onScrollToIndex passed while the drag was settling', () => {
    const firstOnScrollToIndex = jest.fn();
    const latestOnScrollToIndex = jest.fn();
    const { rerender } = render(
      <FastScrollSectionDots
        stickyHeaderIndicesWithData={SECTIONS}
        hideFastScrollIndicatorTimeout={0}
        onScrollToIndex={firstOnScrollToIndex}
      />
    );
    drag([FINGER_ON.fruits, FINGER_ON.dairy]);

    rerender(
      <FastScrollSectionDots
        stickyHeaderIndicesWithData={SECTIONS}
        hideFastScrollIndicatorTimeout={0}
        onScrollToIndex={latestOnScrollToIndex}
      />
    );
    act(() => jest.advanceTimersByTime(1000));

    expect(latestOnScrollToIndex.mock.calls).toEqual([[9]]);
    expect(firstOnScrollToIndex).not.toHaveBeenCalled();
  });

  it('waits for the debounceOnScrollToIndexDelay of the latest render', () => {
    const onScrollToIndex = jest.fn();
    const { rerender } = render(
      <FastScrollSectionDots
        stickyHeaderIndicesWithData={SECTIONS}
        hideFastScrollIndicatorTimeout={0}
        onScrollToIndex={onScrollToIndex}
      />
    );
    rerender(
      <FastScrollSectionDots
        stickyHeaderIndicesWithData={SECTIONS}
        hideFastScrollIndicatorTimeout={0}
        onScrollToIndex={onScrollToIndex}
        debounceOnScrollToIndexDelay={300}
      />
    );

    drag([FINGER_ON.fruits, FINGER_ON.dairy]);
    act(() => jest.advanceTimersByTime(299));
    expect(onScrollToIndex).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(1));
    expect(onScrollToIndex.mock.calls).toEqual([[9]]);
  });

  it('does not scroll the list once it unmounts while a drag is settling', () => {
    const onScrollToIndex = jest.fn();
    const { unmount } = render(
      <FastScrollSectionDots
        stickyHeaderIndicesWithData={SECTIONS}
        hideFastScrollIndicatorTimeout={0}
        onScrollToIndex={onScrollToIndex}
      />
    );
    drag([FINGER_ON.fruits, FINGER_ON.dairy]);

    unmount();
    act(() => jest.advanceTimersByTime(1000));

    expect(onScrollToIndex).not.toHaveBeenCalled();
  });

  it('scrolls the list to the first item of a section tapped in the section list', () => {
    const { onScrollToIndex } = renderDots({
      hideFastScrollIndicatorTimeout: 0,
    });
    drag([FINGER_ON.fruits]);
    act(() => jest.advanceTimersByTime(1000));

    tapSectionListRow(SECTION.dairy);

    expect(onScrollToIndex).toHaveBeenLastCalledWith(10);
    expect(screen.queryByText('Dairy')).not.toBeOnTheScreen();
  });

  // A finger that lands on a row to scroll the section list must not pick that
  // row: the tap fails once the finger moves (or the list takes the touch over).
  it.each([
    ['moves away', State.FAILED],
    ['is taken over by the scrolling list', State.CANCELLED],
  ])(
    'keeps the section list open when a touch on a row %s',
    (_, finalState) => {
      const { onScrollToIndex } = renderDots({
        hideFastScrollIndicatorTimeout: 0,
      });
      drag([FINGER_ON.fruits]);
      act(() => jest.advanceTimersByTime(1000));
      onScrollToIndex.mockClear();

      touchSectionListRow(SECTION.dairy, finalState);

      expect(onScrollToIndex).not.toHaveBeenCalled();
      expect(screen.getByText('Dairy')).toBeOnTheScreen();
    }
  );

  it('stays on the tapped section when it is tapped before the drag settles', () => {
    const { onScrollToIndex } = renderDots({
      hideFastScrollIndicatorTimeout: 0,
    });
    drag([FINGER_ON.fruits, FINGER_ON.vegetables]);

    tapSectionListRow(SECTION.dairy);
    act(() => jest.advanceTimersByTime(1000));

    expect(onScrollToIndex.mock.calls).toEqual([[10]]);
  });

  it('keeps the dots on screen while the section list is open and hides both afterwards', () => {
    const { scrollList } = renderDots({ hideFastScrollIndicatorTimeout: 1000 });
    scrollList();
    drag([FINGER_ON.vegetables]);

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
    drag([FINGER_ON.fruits]);
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
    drag([FINGER_ON.fruits]);
    layoutSectionList({ visibleHeight: 40, rowHeight: 30 });
    const scrollTo: jest.Mock = getSectionListScrollView().instance.scrollTo;
    // Count only what the next touch does, not the scroll to the tapped Fruits.
    scrollTo.mockClear();

    touchDown(FINGER_ON.dairy);

    // Dairy's row spans 60..90; centered in a 40px list, the list shows 55..95.
    expect(scrollTo.mock.calls).toEqual([[{ y: 55 }]]);

    // The retry covers rows that were not measured yet on the first attempt.
    act(() => jest.advanceTimersByTime(999));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(1));
    expect(scrollTo.mock.calls).toEqual([[{ y: 55 }], [{ y: 55 }]]);
  });
});
