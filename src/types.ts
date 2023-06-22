import type React from 'react';
import type { ColorValue } from 'react-native';

export type ScrollToIndex = (params: {
  animated?: boolean | null | undefined;
  index: number;
  viewOffset?: number | undefined;
  viewPosition?: number | undefined;
}) => void;

export type Section = {
  text:
    | string
    | ((props: {
        section: SectionFullData;
        isActive: boolean;
      }) => React.ReactElement | JSX.Element);
  /**
   * The position of this section on the overall list
   */
  index: number;

  /**
   * Optional color value for this dot. It will override the dotColor props
   */
  dotColor?: ColorValue;
};

export type SectionFullData = Section & {
  /**
   * The first position of an item of this section on the overall list
   */
  startIndex: number;
  /**
   * The position on this section among all the other sections
   */
  sectionIndex: number;
};

export type SectionDataWithDimensions = SectionFullData & {
  top: number;
  end: number;
  center: number;
};
