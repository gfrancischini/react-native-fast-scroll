import type React from 'react';
import type { ColorValue } from 'react-native';

export type ScrollToIndex = (params: {
  animated?: boolean | null | undefined;
  index: number;
  viewOffset?: number | undefined;
  viewPosition?: number | undefined;
}) => void;

/**
 * The props a section's `text` component receives
 */
export type SectionTextProps = {
  /**
   * The section being rendered, with any extra fields the app put on it
   */
  section: SectionFullData;
  /**
   * If this section is the active one
   */
  isActive: boolean;
};

export type Section = {
  /**
   * The section's label: a string, or a component that renders it from
   * `SectionTextProps`. Any component works: a plain function, a class, or the
   * result of `React.memo` / `React.forwardRef`.
   */
  text: string | React.ComponentType<SectionTextProps>;
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
