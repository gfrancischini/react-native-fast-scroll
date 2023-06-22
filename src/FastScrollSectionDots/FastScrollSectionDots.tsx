import type { SectionFullData, Section } from '../types';

import React, { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, ColorValue, View } from 'react-native';
import Animated, {
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from 'react-native-reanimated';
import { useHideFlatBar } from '../utils';
import FastScrollSectionFullList from './FastScrollSectionFullList';
import { findNearestActiveSection } from '../utils';
import { createFullSectionData } from './utils';
import FastScrollSectionDotsBar from './FastScrollSectionDotsBar';
import { debounce } from 'throttle-debounce';

export type Props = {
  stickyHeaderIndices?: number[];

  /**
   * Stick header indicies with additional data
   */
  stickyHeaderIndicesWithData?: Section[];

  /**
   * The side that the thumbSize will grow
   * @default right
   */
  side?: 'left' | 'right';

  /**
   * Size of dot
   * @default 10
   */
  dotSize?: number;

  /**
   * Margin between dots;
   * @default: 12
   */
  dotMargin?: number;

  /**
   * The scale that should be applied when thumb is being pressed
   * @default 1.5
   */
  thumbScaleOnPress?: number;

  /**
   * The thumb color
   * @default 'rgba(255, 255, 255, 0.9)'
   */
  thumbColor?: ColorValue;

  /**
   * Color of dots
   */
  dotColor?: ColorValue;

  /**
   * The color of the scroll bar
   * @default 'rgba(65, 64, 66, 0.9)'
   */
  scrollBarColor?: ColorValue;

  /**
   * Implement this method to call the onScroll method of your list
   * @param offset The percentage offset to scroll to
   */
  scrollToOffsetPercentage: (offset: number) => void;

  /**
   * Hide the fast scroll indicator after timeout. This value is in ms
   * If set to 0 the scroll indicator will never be hide
   * The fast scroll indicator becomes available once the list is scrolled
   * @default 2000
   */
  hideFastScrollIndicatorTimeout?: number;

  /**
   * Implement this method to scroll your list to the required index
   * @param index The index to scroll the list
   */
  onScrollToIndex: (index: number) => void;

  /**
   * miliseconds to debounce onScrollToIndex
   * @default 1000
   */
  debounceOnScrollToIndexDelay?: number;
};

export type FastScrollSectionDotsHandle = {
  /**
   * Call this method when the onScroll of your list changes
   * You need to calculate the percentage between 0 and 1
   * @param offsetPercentage between 0 and 1
   */
  onScrollToOffsetPercentage: (offsetPercentage: number) => void;

  /**
   * Call this method when viewable indicies changes
   * @param index The first visible index of the list
   */
  onViewableIndexChanged: (index: number) => void;
};

const FastScrollSectionDots = React.forwardRef(
  (
    {
      side = 'right',
      onScrollToIndex,
      dotSize = 10,
      thumbScaleOnPress = 1.5,
      thumbColor = 'rgba(255, 255, 255, 0.8)',
      dotColor = 'white',
      hideFastScrollIndicatorTimeout = 2000,
      scrollBarColor = 'rgba(65, 64, 66, 0.9)',
      stickyHeaderIndices,
      stickyHeaderIndicesWithData,
      dotMargin = 12,
      debounceOnScrollToIndexDelay = 1000,
    }: Props,
    forwardedRef: React.ForwardedRef<FastScrollSectionDotsHandle>
  ) => {
    console.log('FastScrollSectionDots', FastScrollSectionDots);

    const { showFastScrollBar, lockScrollBarVisibility, visible } =
      useHideFlatBar({
        barWidth: 100,
        hideFastScrollIndicatorTimeout,
      });

    const fastScrollSectionDotsBarRef =
      useRef<React.ElementRef<typeof FastScrollSectionDotsBar>>(null);

    const sections = useMemo(() => {
      return createFullSectionData({
        stickyHeaderIndices,
        stickyHeaderIndicesWithData,
      });
    }, [stickyHeaderIndices, stickyHeaderIndicesWithData]);

    React.useImperativeHandle(
      forwardedRef,
      (): FastScrollSectionDotsHandle => ({
        onScrollToOffsetPercentage() {
          showFastScrollBar();
        },

        onViewableIndexChanged(index: number) {
          const section = findNearestActiveSection(sections, index);
          if (section && fastScrollSectionDotsBarRef.current) {
            fastScrollSectionDotsBarRef.current?.onSectionChange(section);
          }
        },
      })
    );

    const enteringAnimation = (
      side === 'left' ? SlideInLeft : SlideInRight
    ).duration(500);

    const exitingAnimation = (
      side === 'left' ? SlideOutLeft : SlideOutRight
    ).duration(500);

    const onHide = useCallback(() => {
      lockScrollBarVisibility(false);
    }, [lockScrollBarVisibility]);

    const debouncedScrollToIndex = useRef(
      debounce(
        debounceOnScrollToIndexDelay,
        (index: number) => {
          onScrollToIndex(index);
        },
        { atBegin: false }
      )
    );

    const onSectionChange = useCallback(
      (section: SectionFullData) => {
        debouncedScrollToIndex.current(section.index);

        if (section) {
          // locing the panel as we are opening the full list
          lockScrollBarVisibility(true);
          fastScrollSectionFullListRef.current?.show(section);
        }
      },
      [lockScrollBarVisibility]
    );

    const fastScrollFullListOnScrollToIndex = useCallback(
      (index: number) => {
        // as we have clicked on a item we will not wait the debounce
        // we should scroll directly
        onScrollToIndex(index);
      },
      [onScrollToIndex]
    );

    const fastScrollSectionFullListRef =
      useRef<React.ElementRef<typeof FastScrollSectionFullList>>(null);

    if (sections.length === 0) {
      return null;
    }

    return (
      <View style={[styles.container]} pointerEvents={'box-none'}>
        {visible && (
          <Animated.View
            entering={enteringAnimation}
            exiting={exitingAnimation}
            collapsable={false}
          >
            <FastScrollSectionDotsBar
              ref={fastScrollSectionDotsBarRef}
              sections={sections}
              dotSize={dotSize}
              dotMargin={dotMargin}
              thumbScaleOnPress={thumbScaleOnPress}
              thumbColor={thumbColor}
              dotColor={dotColor}
              scrollBarColor={scrollBarColor}
              side={side}
              onSectionChange={onSectionChange}
            />
          </Animated.View>
        )}
        <FastScrollSectionFullList
          ref={fastScrollSectionFullListRef}
          sections={sections}
          scrollToIndex={fastScrollFullListOnScrollToIndex}
          onHide={onHide}
          backgroundColor={scrollBarColor}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
});

export default React.memo(FastScrollSectionDots);
