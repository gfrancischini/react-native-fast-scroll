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

    const onTabLayout = useCallback(
      (index: number) => (ev: LayoutChangeEvent) => {
        const { x, width, height } = ev.nativeEvent.layout;
        tabsMeasurements.current[index] = {
          left: x,
          right: x + width,
          width,
          height,
        };
      },
      []
    );

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
            {sections.map((section, index) => {
              const isActive =
                section.sectionIndex === currentSection?.sectionIndex;

              return (
                <TouchableOpacity
                  onPress={() => props.onScrollToIndex(section.index)}
                  key={index}
                  onLayout={onTabLayout(index)}
                >
                  <FastScrollSectionTabItem
                    isActive={isActive}
                    section={section}
                    tabBarActiveItemStyle={props.tabBarActiveItemStyle}
                    tabBarActiveItemTextStyle={props.tabBarActiveItemTextStyle}
                    tabBarItemStyle={props.tabBarItemStyle}
                    tabBarItemTextStyle={props.tabBarItemTextStyle}
                  />
                </TouchableOpacity>
              );
            })}
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
