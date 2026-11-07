import { getScrollAmount } from '../utils';
import type { SectionFullData } from '../../types';
import type { LayoutMeasurements } from '../types';

const tabSection = (sectionIndex: number): SectionFullData => ({
  text: `Section ${sectionIndex}`,
  index: sectionIndex,
  startIndex: sectionIndex + 1,
  sectionIndex,
});

const measured = (left: number, width: number): LayoutMeasurements => ({
  left,
  right: left + width,
  width,
  height: 40,
});

describe('getScrollAmount', () => {
  // Four 100px tabs (400px in total) seen through a 200px wide tab bar, so the
  // bar can scroll from 0 to 400 - 200 = 200.
  const tabBar = {
    tabsMeasurements: {
      0: measured(0, 100),
      1: measured(100, 100),
      2: measured(200, 100),
      3: measured(300, 100),
    },
    tabContainerMeasurements: measured(0, 400),
    containerWidth: 200,
  };

  it.each([
    // tab left - (viewport - tab width) / 2
    [1, 50],
    [2, 150],
  ])('centers tab %p by scrolling to %p', (sectionIndex, scrollX) => {
    expect(
      getScrollAmount({ ...tabBar, section: tabSection(sectionIndex) })
    ).toBe(scrollX);
  });

  it('keeps the first tab at the start instead of scrolling before it', () => {
    expect(getScrollAmount({ ...tabBar, section: tabSection(0) })).toBe(0);
  });

  it('stops at the end of the tab bar instead of scrolling past the last tab', () => {
    expect(getScrollAmount({ ...tabBar, section: tabSection(3) })).toBe(200);
  });

  it('does not scroll when the tabs fit in the bar', () => {
    expect(
      getScrollAmount({
        ...tabBar,
        tabContainerMeasurements: measured(0, 150),
        section: tabSection(1),
      })
    ).toBe(0);
  });

  it('does not scroll before anything has been laid out', () => {
    expect(
      getScrollAmount({
        section: tabSection(2),
        tabsMeasurements: {},
        tabContainerMeasurements: null,
        containerWidth: 0,
      })
    ).toBe(0);
  });
});
