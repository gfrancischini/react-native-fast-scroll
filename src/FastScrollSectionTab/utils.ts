import type { SectionFullData } from '../types';
import type { LayoutMeasurements } from './types';

export const getScrollAmount = ({
  section,
  tabsMeasurements,
  tabContainerMeasurements,
  containerWidth,
}: {
  section: SectionFullData;
  tabsMeasurements: Record<number, LayoutMeasurements>;
  tabContainerMeasurements: LayoutMeasurements | null;
  containerWidth: number;
}) => {
  const currentIndex = section.sectionIndex;
  const position = currentIndex;
  const pageOffset = 0;
  const tabWidth = tabsMeasurements[position]?.width ?? 0;
  const nextTabMeasurements = tabsMeasurements[position + 1] ?? 0;
  const nextTabWidth = (nextTabMeasurements && nextTabMeasurements.width) || 0;
  const tabOffset = tabsMeasurements[position]?.left ?? 0;
  const absolutePageOffset = pageOffset * tabWidth;
  let newScrollX = tabOffset + absolutePageOffset;
  newScrollX -=
    (containerWidth - (1 - pageOffset) * tabWidth - pageOffset * nextTabWidth) /
    2;
  newScrollX = newScrollX >= 0 ? newScrollX : 0;
  const rightBoundScroll = Math.max(
    (tabContainerMeasurements?.width ?? 0) - containerWidth,
    0
  );
  newScrollX = newScrollX > rightBoundScroll ? rightBoundScroll : newScrollX;
  return newScrollX;
};
