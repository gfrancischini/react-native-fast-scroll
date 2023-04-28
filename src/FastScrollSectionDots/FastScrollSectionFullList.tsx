import type { SectionFullDataV2 } from '../types';

import React, { useRef, useState, useMemo, useCallback } from 'react';
import { ColorValue, ListRenderItemInfo, StyleSheet } from 'react-native';

import Animated, { SlideInLeft, SlideOutLeft } from 'react-native-reanimated';
import { useTimer } from '../utils';
import FastScrollSectionFullListItem from './FastScrollSectionFullListItem';

type Props = {
  /**
   * Section to render
   */
  sections: SectionFullDataV2[];

  /**
   * The current nearest active section
   */
  nearestActiveSection: SectionFullDataV2 | null;

  /**
   * Implement this method to scroll your list to the specific index
   * @param index
   * @returns
   */
  scrollToIndex: (index: number) => void;

  /**
   * Callback for hiding this component
   */
  onHide: () => void;

  /**
   * The background color of the list
   */
  backgroundColor: ColorValue;
};

export type FastScrollSectionFullListHandle = {
  /**
   * Call this method when index change or when to show this bar
   * @param index The first index
   */
  show: (activeSection: SectionFullDataV2) => void;
};

const FastScrollSectionFullList = React.forwardRef(
  (
    {
      sections,
      nearestActiveSection,
      scrollToIndex,
      onHide,
      backgroundColor,
    }: Props,
    forwardedRef: React.ForwardedRef<FastScrollSectionFullListHandle>
  ) => {
    const flatListRef = useRef<React.ElementRef<
      typeof Animated.FlatList<SectionFullDataV2>
    > | null>(null);

    const [activeIndexVisible, setActiveIndexVisible] = useState(false);

    const [activeSection, setActiveSection] = useState(nearestActiveSection);

    const activeIndexVisibleCallbacks = useMemo(() => {
      return {
        callbackTimeout: () => {
          setActiveIndexVisible(false);
          onHide();
        },
        callbackSchedule: () => {
          setActiveIndexVisible(true);
        },
        timeout: 3000,
      };
    }, [onHide]);

    const [startShowActiveIndexVisibleTimer] = useTimer(
      activeIndexVisibleCallbacks
    );

    const closeAndScrollToIndex = useCallback(
      (index: number) => {
        setActiveIndexVisible(false);
        scrollToIndex(index);
      },
      [scrollToIndex]
    );

    React.useImperativeHandle(
      forwardedRef,
      (): FastScrollSectionFullListHandle => ({
        show(section: SectionFullDataV2) {
          setActiveIndexVisible(true);
          setActiveSection(section);
          startShowActiveIndexVisibleTimer();
          if (flatListRef.current) {
            // TODO: Why is this wrong?
            // @ts-ignore
            flatListRef.current?.scrollToIndex({
              index: section.sectionIndex,
              viewPosition: 0.5,
            });
          }
        },
      })
    );

    const styles = useMemo(
      () =>
        StyleSheet.create({
          list: {
            flex: 1,
            backgroundColor,
            borderRadius: 16,
          },
          listContainer: {
            paddingVertical: 5,
          },
        }),
      [backgroundColor]
    );

    if (!activeIndexVisible) {
      return null;
    }

    return (
      <Animated.FlatList
        entering={SlideInLeft}
        exiting={SlideOutLeft}
        ref={flatListRef}
        style={styles.list}
        contentContainerStyle={styles.listContainer}
        onScrollToIndexFailed={() => {
          // just ignore to avoid errors/crashes
        }}
        onScroll={() => {
          startShowActiveIndexVisibleTimer();
        }}
        data={sections}
        renderItem={({
          item,
          index,
        }: ListRenderItemInfo<SectionFullDataV2>) => (
          <FastScrollSectionFullListItem
            index={index}
            isActive={item.sectionIndex === activeSection?.sectionIndex}
            item={item}
            scrollToIndex={closeAndScrollToIndex}
          />
        )}
        extraData={activeSection?.sectionIndex}
      />
    );
  }
);

export default React.memo(FastScrollSectionFullList);
