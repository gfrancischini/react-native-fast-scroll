import { act, renderHook } from '@testing-library/react-native';
import {
  createFullSectionData,
  findNearestActiveSection,
  useHideFlatBar,
  useTimer,
} from '../utils';

describe('findNearestActiveSection', () => {
  const sections = [{ index: 0 }, { index: 5 }, { index: 10 }];

  it.each([
    [0, 0],
    [4, 0],
    [5, 5],
    [9, 5],
    [10, 10],
    [250, 10],
  ])(
    'maps the visible item %i to the section whose header is at %i',
    (item, header) => {
      expect(findNearestActiveSection(sections, item).index).toBe(header);
    }
  );

  it('finds no section for an item above the first header', () => {
    // The return type says a section is always found; callers rely on a
    // runtime check instead.
    expect(findNearestActiveSection([{ index: 3 }], 1)).toBeUndefined();
  });
});

describe('createFullSectionData', () => {
  it('derives the first item and the order of each section from its header index', () => {
    const result = createFullSectionData({
      stickyHeaderIndicesWithData: [
        { index: 0, text: 'Fruits', dotColor: 'red' },
        { index: 4, text: 'Vegetables' },
      ],
    });

    expect(result).toEqual([
      {
        index: 0,
        text: 'Fruits',
        dotColor: 'red',
        startIndex: 1,
        sectionIndex: 0,
      },
      { index: 4, text: 'Vegetables', startIndex: 5, sectionIndex: 1 },
    ]);
  });

  it('passes app-specific fields through to the section', () => {
    // Apps attach their own data to a section and read it back in the `text`
    // component, so unknown fields must survive.
    const appSections = [{ index: 0, text: 'Fruits', label: 'Fresh/Fruits' }];

    const [section] = createFullSectionData({
      stickyHeaderIndicesWithData: appSections,
    });

    expect(section).toEqual(expect.objectContaining({ label: 'Fresh/Fruits' }));
  });

  it('labels every section built from plain header indices with "1"', () => {
    // Characterization: plain `stickyHeaderIndices` carry no text, and the
    // placeholder is the literal '1' for every section.
    expect(createFullSectionData({ stickyHeaderIndices: [0, 3] })).toEqual([
      { index: 0, text: '1', startIndex: 1, sectionIndex: 0 },
      { index: 3, text: '1', startIndex: 4, sectionIndex: 1 },
    ]);
  });

  it('uses the sections with data when both inputs are given', () => {
    const result = createFullSectionData({
      stickyHeaderIndices: [0, 3, 7],
      stickyHeaderIndicesWithData: [{ index: 2, text: 'Dairy' }],
    });

    expect(result).toEqual([
      { index: 2, text: 'Dairy', startIndex: 3, sectionIndex: 0 },
    ]);
  });

  it('builds no sections when no headers are given', () => {
    expect(createFullSectionData({})).toEqual([]);
  });
});

describe('useHideFlatBar', () => {
  beforeEach(() => jest.useFakeTimers());

  const renderBar = (hideFastScrollIndicatorTimeout: number) =>
    renderHook(() =>
      useHideFlatBar({ barWidth: 100, hideFastScrollIndicatorTimeout })
    );

  it('hides the bar exactly when the timeout elapses after it is shown', () => {
    const { result } = renderBar(1000);
    expect(result.current.visible).toBe(false);

    act(() => result.current.showFastScrollBar());
    act(() => jest.advanceTimersByTime(999));
    expect(result.current.visible).toBe(true);

    act(() => jest.advanceTimersByTime(1));
    expect(result.current.visible).toBe(false);
  });

  it('restarts the timeout every time the bar is shown again', () => {
    const { result } = renderBar(1000);

    act(() => result.current.showFastScrollBar());
    act(() => jest.advanceTimersByTime(800));
    act(() => result.current.showFastScrollBar());
    act(() => jest.advanceTimersByTime(800));
    expect(result.current.visible).toBe(true);

    act(() => jest.advanceTimersByTime(200));
    expect(result.current.visible).toBe(false);
  });

  it('shows the bar on mount and never hides it when the timeout is 0', () => {
    const { result } = renderBar(0);
    expect(result.current.visible).toBe(true);

    act(() => jest.advanceTimersByTime(60_000));
    expect(result.current.visible).toBe(true);
  });

  it('keeps the bar visible while locked and hides it one timeout after unlocking', () => {
    const { result } = renderBar(1000);

    act(() => result.current.lockScrollBarVisibility(true));
    act(() => jest.advanceTimersByTime(10_000));
    expect(result.current.visible).toBe(true);

    act(() => result.current.lockScrollBarVisibility(false));
    act(() => jest.advanceTimersByTime(999));
    expect(result.current.visible).toBe(true);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current.visible).toBe(false);
  });

  it('leaves no hide timer running once it unmounts', () => {
    const { result, unmount } = renderBar(1000);
    act(() => result.current.showFastScrollBar());

    unmount();
    // The slide-in spring was cancelled with the hook, but Reanimated had
    // already requested its next frame; let that one frame pass.
    act(() => jest.advanceTimersByTime(16));

    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('useTimer', () => {
  beforeEach(() => jest.useFakeTimers());

  it('reports the start immediately and the timeout once it elapses', () => {
    const callbackSchedule = jest.fn();
    const callbackTimeout = jest.fn();
    const { result } = renderHook(() =>
      useTimer({ callbackSchedule, callbackTimeout, timeout: 500 })
    );

    act(() => result.current[0]());
    expect(callbackSchedule).toHaveBeenCalledTimes(1);

    act(() => jest.advanceTimersByTime(499));
    expect(callbackTimeout).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(callbackTimeout).toHaveBeenCalledTimes(1);
  });

  it('pushes the timeout back when restarted before it elapses', () => {
    const callbackTimeout = jest.fn();
    const { result } = renderHook(() =>
      useTimer({ callbackSchedule: jest.fn(), callbackTimeout, timeout: 500 })
    );

    act(() => result.current[0]());
    act(() => jest.advanceTimersByTime(400));
    act(() => result.current[0]());
    act(() => jest.advanceTimersByTime(400));
    expect(callbackTimeout).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(100));
    expect(callbackTimeout).toHaveBeenCalledTimes(1);
  });

  it('never times out once cleared', () => {
    const callbackTimeout = jest.fn();
    const { result } = renderHook(() =>
      useTimer({ callbackSchedule: jest.fn(), callbackTimeout, timeout: 500 })
    );
    const [startTimer, clearTimer] = result.current;

    act(() => startTimer());
    act(() => clearTimer());
    act(() => jest.advanceTimersByTime(10_000));

    expect(callbackTimeout).not.toHaveBeenCalled();
  });

  it('never times out once unmounted', () => {
    const callbackTimeout = jest.fn();
    const { result, unmount } = renderHook(() =>
      useTimer({ callbackSchedule: jest.fn(), callbackTimeout, timeout: 500 })
    );
    act(() => result.current[0]());

    unmount();
    act(() => jest.advanceTimersByTime(10_000));

    expect(callbackTimeout).not.toHaveBeenCalled();
  });

  it('starts on mount and never times out when the timeout is 0', () => {
    const callbackSchedule = jest.fn();
    const callbackTimeout = jest.fn();

    renderHook(() =>
      useTimer({ callbackSchedule, callbackTimeout, timeout: 0 })
    );
    act(() => jest.advanceTimersByTime(60_000));

    expect(callbackSchedule).toHaveBeenCalled();
    expect(callbackTimeout).not.toHaveBeenCalled();
  });
});
