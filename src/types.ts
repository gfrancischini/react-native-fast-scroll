import type React from 'react';
import type { ColorValue } from 'react-native';

export type ScrollToIndex = (params: {
  animated?: boolean | null | undefined;
  index: number;
  viewOffset?: number | undefined;
  viewPosition?: number | undefined;
}) => void;

export type Section<T> = {
  data: string | NonNullable<T>;
  /**
   * The position of this section on the overall list
   */
  index: number;
  /**
   * The first position of an item of this section on the overall list
   */
  startIndex: number;
  /**
   * The last position of an item of this section on the overall list
   */
  endIndex: number;
  /**
   * The total items that belong to this section
   */
  count: number;
  /**
   * The position on this section among all the other sections
   */
  sectionIndex: number;
};

export type SectionV2 = {
  text:
    | string
    | ((props: {
        section: SectionFullDataV2;
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

export type SectionFullDataV2 = SectionV2 & {
  /**
   * The first position of an item of this section on the overall list
   */
  startIndex: number;
  /**
   * The position on this section among all the other sections
   */
  sectionIndex: number;
};
