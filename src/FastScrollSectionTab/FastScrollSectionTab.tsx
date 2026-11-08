import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  LayoutChangeEvent,
  ViewStyle,
  StyleSheet,
  TextStyle,
} from 'react-native';
import FastScrollSectionTabItem from './FastScrollSectionTabItem';
import type { Section, SectionFullData } from '../types';
import { createFullSectionData } from '../utils';
import { findNearestActiveSection } from '../utils';
import type { LayoutMeasurements } from './types';
import { getScrollAmount } from './utils';

type Props = {
  /**
   * Plain stick header indicies (same as FlashList)
   * If you want to have additional data you can use directly `stickyHeaderIndicesWithData`
   */
  stickyHeaderIndices?: number[];

  /**
   * Stick header indicies with additional data
   */
  stickyHeaderIndicesWithData?: Section[];

  tabBarStyle?: ViewStyle;
  tabBarItemStyle?: ViewStyle;
  tabBarItemTextStyle?: TextStyle;
  tabBarActiveItemStyle?: ViewStyle;
  tabBarActiveItemTextStyle?: TextStyle;
  // currentIndex: number;
  /**
   * Implement this method to scroll your list to the required index
   * @param index The index to scroll the list
   */
  onScrollToIndex: (index: number) => void;
};

type FastScrollSectionTabHandle = {
  /**
   * Call this method when viewable indicies changes
   * @param index The first visible index of the list
   */
  onViewableIndexChanged: (index: number) => void;
};

type TabButtonProps = {
  index: number;
  section: SectionFullData;
  isActive: boolean;
  onPressSection: (section: SectionFullData) => void;
  onTabLayout: (index: number, ev: LayoutChangeEvent) => void;
  tabBarItemStyle?: ViewStyle;
  tabBarItemTextStyle?: TextStyle;
  tabBarActiveItemStyle?: ViewStyle;
  tabBarActiveItemTextStyle?: TextStyle;
};

/**
 * One tab. Memoized so that a change of the active section re-renders only
 * the two tabs whose `isActive` flips: on React Native 0.70 every re-render of
 * a TouchableOpacity starts a native opacity animation.
 */
const FastScrollSectionTabButton = React.memo(
  ({
    index,
    section,
    isActive,
    onPressSection,
    onTabLayout,
    ...itemStyles
  }: TabButtonProps) => {
    const onPress = useCallback(
      () => onPressSection(section),
      [onPressSection, section]
    );
    const onLayout = useCallback(
      (ev: LayoutChangeEvent) => onTabLayout(index, ev),
      [onTabLayout, index]
    );

    return (
      <TouchableOpacity onPress={onPress} onLayout={onLayout}>
        <FastScrollSectionTabItem
          isActive={isActive}
          section={section}
          {...itemStyles}
        />
      </TouchableOpacity>
    );
  }
);

const FastScrollSectionTab = React.forwardRef<
  FastScrollSectionTabHandle,
  Props
>(
  (
    { stickyHeaderIndices, stickyHeaderIndicesWithData, ...props }: Props,
    forwardedRef
  ) => {
    const sections = useMemo(() => {
      return createFullSectionData({
        stickyHeaderIndices,
        stickyHeaderIndicesWithData,
      });
    }, [stickyHeaderIndices, stickyHeaderIndicesWithData]);

    const tabScrollView = useRef<ScrollView>(null);

    const tabsMeasurements = useRef<Record<number, LayoutMeasurements>>({});

    const containerMeasurements = useRef<LayoutMeasurements | null>(null);
    const tabContainerMeasurements = useRef<LayoutMeasurements | null>(null);

    const [currentSection, setCurrentSection] =
      useState<SectionFullData | null>(null);
    const currentSectionRef = useRef<SectionFullData | null>(null);

    React.useImperativeHandle(
      forwardedRef,
      (): FastScrollSectionTabHandle => ({
        onViewableIndexChanged(index: number) {
          const section = findNearestActiveSection(sections, index);
          if (
            section &&
            tabScrollView.current &&
            currentSectionRef.current !== section
          ) {
            currentSectionRef.current = section;
            setCurrentSection(section);
            tabScrollView.current.scrollTo({
              x: getScrollAmount({
                section,
                tabsMeasurements: tabsMeasurements.current,
                tabContainerMeasurements: tabContainerMeasurements.current,
                containerWidth: containerMeasurements.current?.width ?? 0,
              }),
              animated: true,
            });
          }
        },
      })
    );

    const onTabLayout = useCallback((index: number, ev: LayoutChangeEvent) => {
      const { x, width, height } = ev.nativeEvent.layout;
      tabsMeasurements.current[index] = {
        left: x,
        right: x + width,
        width,
        height,
      };
    }, []);

    // Stable across renders so a tab only re-renders when its own props
    // change; reads the latest onScrollToIndex when a tab is tapped.
    const onScrollToIndexRef = useRef(props.onScrollToIndex);
    onScrollToIndexRef.current = props.onScrollToIndex;
    const onPressSection = useCallback((section: SectionFullData) => {
      onScrollToIndexRef.current(section.index);
    }, []);

    const onTabContainerLayout = useCallback((ev: LayoutChangeEvent) => {
      const { x, width, height } = ev.nativeEvent.layout;
      tabContainerMeasurements.current = {
        left: x,
        right: x + width,
        width,
        height,
      };
    }, []);

    const onContainerLayout = useCallback((ev: LayoutChangeEvent) => {
      const { x, width, height } = ev.nativeEvent.layout;
      containerMeasurements.current = {
        left: x,
        right: x + width,
        width,
        height,
      };
    }, []);

    const { tabBarStyle } = props;
    return (
      <View onLayout={onContainerLayout}>
        <ScrollView
          ref={tabScrollView}
          showsHorizontalScrollIndicator={false}
          horizontal
          contentContainerStyle={styles.scrollContainer}
        >
          <View
            onLayout={onTabContainerLayout}
            style={[styles.tabBar, tabBarStyle]}
          >
            {sections.map((section, index) => (
              <FastScrollSectionTabButton
                key={index}
                index={index}
                section={section}
                isActive={section.sectionIndex === currentSection?.sectionIndex}
                onPressSection={onPressSection}
                onTabLayout={onTabLayout}
                tabBarActiveItemStyle={props.tabBarActiveItemStyle}
                tabBarActiveItemTextStyle={props.tabBarActiveItemTextStyle}
                tabBarItemStyle={props.tabBarItemStyle}
                tabBarItemTextStyle={props.tabBarItemTextStyle}
              />
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  scrollContainer: {
    flexDirection: 'row',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomColor: 'gray',
    borderBottomWidth: 1,
  },
});

export default FastScrollSectionTab;
