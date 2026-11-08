import type { SectionDataWithDimensions, SectionFullData } from '../types';
import { snapPoint } from 'react-native-redash';

export const calculateYPosition = ({
  y,
  sections,
  dotSize,
  dotMargin,
}: {
  y: number;
  sections: Pick<SectionFullData, 'sectionIndex'>[];
  dotSize: number;
  dotMargin: number;
}) => {
  'worklet';
  const minHeight = dotSize / 2;
  const maxHeight =
    ((sections[sections.length - 1]?.sectionIndex || 0) + 1) *
      (dotMargin + dotSize) -
    dotSize / 2;
  const yPosition = y < minHeight ? minHeight : y > maxHeight ? maxHeight : y;
  const yPercentage = (yPosition - minHeight) / (maxHeight - minHeight);
  return {
    yPosition: yPosition - dotSize / 2,
    yPercentage,
  };
};

export const findSectionOnPosition = (
  positionY: number,
  sections: SectionDataWithDimensions[]
) => {
  'worklet';
  const snapPoints = sections.map((section) => section.y);
  const newTranslate = snapPoint(positionY, 0, snapPoints);
  const activeSession = sections.find((s) => s.y === newTranslate);
  return activeSession;
};
