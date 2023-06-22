import type {
  SectionFullData,
  Section,
  SectionDataWithDimensions,
} from '../types';
import { snapPoint } from 'react-native-redash';

export const calculateYPosition = ({
  y,
  sections,
  dotSize,
  dotMargin,
}: {
  y: number;
  sections: any;
  dotSize: any;
  dotMargin: any;
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

export const createFullSectionData = ({
  stickyHeaderIndicesWithData,
  stickyHeaderIndices,
}: {
  stickyHeaderIndicesWithData?: Section[];
  stickyHeaderIndices?: number[];
}): SectionFullData[] => {
  if (stickyHeaderIndicesWithData != null) {
    return (
      stickyHeaderIndicesWithData.map((value, index) => {
        const startIndex = value.index + 1;
        return {
          ...value,
          startIndex: startIndex,
          sectionIndex: index,
        };
      }) ?? []
    );
  }

  return stickyHeaderIndices
    ? stickyHeaderIndices.map((value, index) => {
        const startIndex = value + 1;
        return {
          text: '1',
          index: value,
          startIndex: startIndex,
          sectionIndex: index,
        };
      })
    : [];
};

export const findSectionOnPosition = (
  positionY: number,
  sections: SectionDataWithDimensions[]
) => {
  'worklet';
  const snapPoints = sections.map((section) => section.center);
  const newTranslate = snapPoint(positionY, 0, snapPoints);
  const activeSession = sections.find((s) => s.center === newTranslate);
  return activeSession;
};
