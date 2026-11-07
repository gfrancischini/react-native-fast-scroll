import { calculateYPosition, findSectionOnPosition } from '../utils';
import type { SectionDataWithDimensions } from '../../types';

const dotSection = (
  sectionIndex: number,
  center: number
): SectionDataWithDimensions => ({
  text: `Section ${sectionIndex}`,
  index: sectionIndex * 10,
  startIndex: sectionIndex * 10 + 1,
  sectionIndex,
  top: 0,
  end: 0,
  center,
});

describe('calculateYPosition', () => {
  // Three dots of size 10 with a margin of 12: the thumb center travels from
  // 10 / 2 = 5 to 3 * (12 + 10) - 10 / 2 = 61.
  const bar = {
    sections: [dotSection(0, 0), dotSection(1, 0), dotSection(2, 0)],
    dotSize: 10,
    dotMargin: 12,
  };

  it.each([
    [-50, 0, 0],
    [5, 0, 0],
    [33, 28, 0.5],
    [61, 56, 1],
    [500, 56, 1],
  ])(
    'places a finger at y=%p at offset %p (%p of the bar)',
    (y, yPosition, yPercentage) => {
      expect(calculateYPosition({ ...bar, y })).toEqual({
        yPosition,
        yPercentage,
      });
    }
  );

  it('treats a bar without sections as a single dot', () => {
    // 1 * (12 + 10) - 5 = 17 is the furthest center, minus half a dot.
    expect(calculateYPosition({ ...bar, sections: [], y: 500 }).yPosition).toBe(
      12
    );
  });
});

describe('findSectionOnPosition', () => {
  // Dot centers as laid out by the dots bar: margin * (i + 1) + size * i.
  const sections = [dotSection(0, 12), dotSection(1, 34), dotSection(2, 56)];

  it.each([
    [0, 0],
    [22, 0],
    [24, 1],
    [44, 1],
    [46, 2],
    [1000, 2],
  ])('snaps the thumb at y=%p to section %p', (y, sectionIndex) => {
    expect(findSectionOnPosition(y, sections)?.sectionIndex).toBe(sectionIndex);
  });
});
