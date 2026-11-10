import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { State, TapGesture } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils';
import { FastScrollSectionDots, Section, SectionTextProps } from '../../index';
import {
  drag,
  getPanArea,
  getPanCallbacks,
  touchDown,
} from '../../__fixtures__/gestures';
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

  /** The app renders the dots again with other sections. */
  const replaceSections = (newSections: Section[]) =>
    screen.rerender(
      <FastScrollSectionDots
        ref={ref}
        stickyHeaderIndicesWithData={newSections}
        hideFastScrollIndicatorTimeout={hideFastScrollIndicatorTimeout}
        onScrollToIndex={onScrollToIndex}
      />
    );

  return { onScrollToIndex, scrollList, showListItem, replaceSections };
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

  it('stops scrolling its dots once the last one reaches the bottom of the bar', () => {
    const { showListItem } = renderDots({
      hideFastScrollIndicatorTimeout: 0,
      sections: Array.from({ length: 30 }, (_, i) => ({
        index: i * 10,
        text: `Aisle ${i}`,
      })),
    });
    layoutDotsBar(300);

    // 30 dots take 12 + 30 * (10 + 12) = 672px; in a 300px bar the strip
    // scrolls at most 672 - 300 = 372px, which shows the last dot at the bottom.
    showListItem(290);

    expect(getDotsScrollOffset()).toBe(-372);
  });

  // The space the app gives the dots changes at runtime: the device rotates, a
  // header above the list grows or shrinks. Each re-layout must keep the active
  // dot in view and never leave the strip scrolled when all the dots fit.
  it('shows every dot again once a bigger bar fits them all', () => {
    const { showListItem } = renderDots({
      hideFastScrollIndicatorTimeout: 0,
      sections: Array.from({ length: 30 }, (_, i) => ({
        index: i * 10,
        text: `Aisle ${i}`,
      })),
    });
    layoutDotsBar(300);
    showListItem(290);
    expect(getDotsScrollOffset()).toBe(-372);

    // The 672px strip fits a 700px bar.
    layoutDotsBar(700);

    expect(getDotsScrollOffset()).toBe(0);
  });

  it('keeps the active dot in view when the bar shrinks', () => {
    const { showListItem } = renderDots({
      hideFastScrollIndicatorTimeout: 0,
      sections: Array.from({ length: 30 }, (_, i) => ({
        index: i * 10,
        text: `Aisle ${i}`,
      })),
    });
    layoutDotsBar(700);
    showListItem(290);
    expect(getDotsScrollOffset()).toBe(0);

    // Aisle 29's dot spans 650..660 of the strip; in a 300px bar the strip
    // scrolls to its end (-372), which shows it at 278..288.
    layoutDotsBar(300);
    expect(getDotsScrollOffset()).toBe(-372);

    // Back to 700px, as when the device rotates back.
    layoutDotsBar(700);
    expect(getDotsScrollOffset()).toBe(0);
  });

  // A finger only reaches the dots through this area. Under Jest nothing is
  // hit-tested, so its size stands in for "every dot can be touched".
  it('lets the finger reach every dot, down to the last one', () => {
    renderDots({ hideFastScrollIndicatorTimeout: 0 });

    // 3 dots: 12 + 3 * (10 + 12) = 78px.
    expect(getPanArea()).toHaveStyle({ height: 78 });
  });

  it('keeps its dots still when they all fit', () => {
    const { showListItem } = renderDots({ hideFastScrollIndicatorTimeout: 0 });
    layoutDotsBar(300);

    showListItem(9);

    expect(getDotsScrollOffset()).toBe(0);
  });

  // Apps show the dots from onScroll but usually report the first visible item
  // only once the list stops, so the dots reappear before the next report.
  it('shows the thumb on the current section when the dots reappear', () => {
    const { scrollList, showListItem } = renderDots({
      hideFastScrollIndicatorTimeout: 1000,
    });
    scrollList();
    showListItem(7);
    act(() => jest.advanceTimersByTime(1000));
    expect(isAnythingShown()).toBe(false);

    scrollList();

    expect(getThumbPosition()).toBe(THUMB_ON.vegetables);
  });

  it('shows the thumb on the section the list reached while the dots were hidden', () => {
    const { scrollList, showListItem } = renderDots({
      hideFastScrollIndicatorTimeout: 1000,
    });

    showListItem(250);
    scrollList();

    expect(getThumbPosition()).toBe(THUMB_ON.dairy);
  });

  it('shows the thumb on the dragged section when the dots reappear', () => {
    const { scrollList } = renderDots({ hideFastScrollIndicatorTimeout: 1000 });
    scrollList();
    drag([FINGER_ON.fruits, FINGER_ON.dairy]);
    // The section list closes after 3 s, then the dots after their 1 s.
    act(() => jest.advanceTimersByTime(4000));
    expect(isAnythingShown()).toBe(false);

    scrollList();

    expect(getThumbPosition()).toBe(THUMB_ON.dairy);
  });

  it('shows the thumb on a dot of the current sections when the app replaced them while the dots were hidden', () => {
    const { scrollList, showListItem, replaceSections } = renderDots({
      hideFastScrollIndicatorTimeout: 1000,
    });
    showListItem(250);

    // Dairy, the third section, is gone; item 250 now falls under Vegetables.
    replaceSections(SECTIONS.slice(0, 2));
    scrollList();

    expect(getThumbPosition()).toBe(THUMB_ON.vegetables);
  });

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

  it('scrolls the list to the dragged section a second after the finger reaches its dot, even while the finger keeps moving over it', () => {
    const { onScrollToIndex } = renderDots({
      hideFastScrollIndicatorTimeout: 0,
    });
    const finger = touchDown(FINGER_ON.fruits);
    finger.moveTo(FINGER_ON.vegetables);
    act(() => jest.advanceTimersByTime(600));

    // A few pixels further down, still nearest to Vegetables' dot.
    finger.moveTo(FINGER_ON.vegetables + 3);
    act(() => jest.advanceTimersByTime(399));
    expect(onScrollToIndex).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(1));
    expect(onScrollToIndex.mock.calls).toEqual([[5]]);
  });

  it('opens the section list again when a new touch lands on the dot the last drag ended on', () => {
    renderDots({ hideFastScrollIndicatorTimeout: 0 });
    drag([FINGER_ON.fruits, FINGER_ON.vegetables]);
    // The section list closes 3 s after the finger lifts.
    act(() => jest.advanceTimersByTime(3000));
    expect(screen.queryByText('Vegetables')).not.toBeOnTheScreen();

    touchDown(FINGER_ON.vegetables);

    expect(screen.getByText('Vegetables')).toBeOnTheScreen();
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

  it('leaves no timer running once it unmounts while the section list is open', () => {
    // An app screen that closes while the dots and the section list are on
    // screen, right after a touch moved the open section list.
    const { scrollList } = renderDots({ hideFastScrollIndicatorTimeout: 1000 });
    scrollList();
    drag([FINGER_ON.fruits]);
    touchDown(FINGER_ON.dairy).lift();

    screen.unmount();
    // Let the exit animations, which run on Reanimated's own timers, finish;
    // the section list's retry is still 500 ms away and its auto-hide 2.5 s.
    act(() => jest.advanceTimersByTime(500));

    expect(jest.getTimerCount()).toBe(0);
  });

  it('drags through the sections of the latest render', () => {
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
        stickyHeaderIndicesWithData={[
          { index: 0, text: 'Bakery' },
          { index: 4, text: 'Frozen' },
        ]}
        hideFastScrollIndicatorTimeout={0}
        onScrollToIndex={onScrollToIndex}
      />
    );

    // Two dots now: the finger past the last one picks the second section,
    // and the thumb settles on the second dot.
    drag([FINGER_ON.fruits, FINGER_ON.dairy]);
    act(() => jest.advanceTimersByTime(1000));

    expect(getThumbPosition()).toBe(THUMB_ON.vegetables);
    expect(onScrollToIndex.mock.calls).toEqual([[4]]);
    expect(screen.getByText('Frozen')).toBeOnTheScreen();
  });

  // On a device, each rebuilt pan gesture hands Reanimated new worklets, and
  // Reanimated holds the JS functions they call (and copies the values they
  // read) from native code. Apps rebuild their sections and callbacks on
  // every render, and a pan rebuilt with them kept those renders alive.
  // Jest cannot measure that leak; keeping the pan's callbacks the same
  // objects is what prevents it.
  it('keeps the same pan callbacks while the app passes new sections and callbacks on every render', () => {
    // New section objects with new label components, and a new inline
    // onScrollToIndex, each time, as an app's render creates them.
    const dotsFromRender = () => (
      <FastScrollSectionDots
        stickyHeaderIndicesWithData={SECTIONS.map((section) => ({
          ...section,
          text: activeAwareLabel(String(section.text)),
        }))}
        hideFastScrollIndicatorTimeout={0}
        onScrollToIndex={(index) => index}
      />
    );
    const { rerender } = render(dotsFromRender());
    const callbacks = getPanCallbacks();

    rerender(dotsFromRender());
    rerender(dotsFromRender());

    expect(getPanCallbacks()).toBe(callbacks);
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

  it('still scrolls the list after a drag once a row of the section list was tapped', () => {
    const { onScrollToIndex } = renderDots({
      hideFastScrollIndicatorTimeout: 0,
    });
    drag([FINGER_ON.fruits]);
    tapSectionListRow(SECTION.dairy);
    onScrollToIndex.mockClear();

    drag([FINGER_ON.vegetables]);
    act(() => jest.advanceTimersByTime(1000));

    expect(onScrollToIndex.mock.calls).toEqual([[5]]);
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

  it('keeps the section list and the dots open while the finger rests on the dots', () => {
    const { scrollList } = renderDots({ hideFastScrollIndicatorTimeout: 1000 });
    scrollList();

    // The finger lands on a dot, moves to another, then stays still.
    const finger = touchDown(FINGER_ON.fruits);
    finger.moveTo(FINGER_ON.vegetables);
    act(() => jest.advanceTimersByTime(10_000));
    expect(screen.getByText('Vegetables')).toBeOnTheScreen();

    // Once it lifts, the section list closes 3 s later, then the dots.
    finger.lift();
    act(() => jest.advanceTimersByTime(2999));
    expect(screen.getByText('Vegetables')).toBeOnTheScreen();
    act(() => jest.advanceTimersByTime(1));
    expect(screen.queryByText('Vegetables')).not.toBeOnTheScreen();
    act(() => jest.advanceTimersByTime(1000));
    expect(isAnythingShown()).toBe(false);
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
