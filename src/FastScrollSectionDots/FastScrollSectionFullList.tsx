import type { SectionFullData } from '../types';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ColorValue,
  FlatList,
  ListRenderItemInfo,
  StyleSheet,
} from 'react-native';

import Animated, { SlideInLeft, SlideOutLeft } from 'react-native-reanimated';
import { useTimer } from '../utils';
import FastScrollSectionFullListItem from './FastScrollSectionFullListItem';

type Props = {
  /**
   * Section to render
   */
  sections: SectionFullData[];

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
  show: (activeSection: SectionFullData) => void;

  /**
   * Keeps the list open while `held` (a finger rests on the dots), then
   * closes it after the usual delay once released.
   */
  hold: (held: boolean) => void;
};

const FastScrollSectionFullList = React.forwardRef(
  (
    { sections, scrollToIndex, onHide, backgroundColor }: Props,
    forwardedRef: React.ForwardedRef<FastScrollSectionFullListHandle>
  ) => {
    /**
     * `Animated.FlatList` forwards its ref to React Native's `FlatList`, but
     * the typings disagree across Reanimated versions: 2.12 declares the
     * instance as a `View` (`interface FlatList<T> extends View<T>`), which has
     * no `scrollToIndex`, and 3 declares React Native's `FlatList`. The
     * callback takes any object so it fits both, and holds the ref as what it
     * is at runtime.
     */
    const flatListRef = useRef<FlatList<SectionFullData> | null>(null);
    const setFlatListRef = useCallback((list: object | null) => {
      flatListRef.current = list as FlatList<SectionFullData> | null;
    }, []);

    const [activeIndexVisible, setActiveIndexVisible] = useState(false);

    const [activeSection, setActiveSection] = useState<SectionFullData | null>(
      null
    );

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

    const [startHideTimer, clearHideTimer, scheduleHideTimer] = useTimer(
      activeIndexVisibleCallbacks
    );

    // The list closes a while after the last show() or scroll. show() only
    // runs while the finger moves on the dots, so a finger resting on them
    // holds the list open instead.
    const held = useRef(false);
    const startShowActiveIndexVisibleTimer = useCallback(() => {
      startHideTimer();
      if (held.current) {
        clearHideTimer();
      }
    }, [clearHideTimer, startHideTimer]);

    const closeAndScrollToIndex = useCallback(
      (index: number) => {
        setActiveIndexVisible(false);
        scrollToIndex(index);
      },
      [scrollToIndex]
    );

    const rescrollTimeout = useRef<NodeJS.Timeout | null>(null);

    // A screen can close before the retry runs.
    useEffect(
      () => () => {
        if (rescrollTimeout.current) {
          clearTimeout(rescrollTimeout.current);
        }
      },
      []
    );

    React.useImperativeHandle(
      forwardedRef,
      (): FastScrollSectionFullListHandle => ({
        show(section: SectionFullData) {
          setActiveIndexVisible(true);
          setActiveSection(section);
          startShowActiveIndexVisibleTimer();
          if (flatListRef.current) {
            flatListRef.current.scrollToIndex({
              index: section.sectionIndex,
              viewPosition: 0.5,
            });
            if (rescrollTimeout.current) {
              clearTimeout(rescrollTimeout.current);
              rescrollTimeout.current = null;
            }
            rescrollTimeout.current = setTimeout(() => {
              if (flatListRef.current) {
                flatListRef.current.scrollToIndex({
                  index: section.sectionIndex,
                  viewPosition: 0.5,
                });
              }
            }, 1000);
          }
        },
        hold(isHeld: boolean) {
          held.current = isHeld;
          if (isHeld) {
            clearHideTimer();
          } else {
            scheduleHideTimer();
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
        ref={setFlatListRef}
        style={styles.list}
        contentContainerStyle={styles.listContainer}
        onScrollToIndexFailed={() => {
          // just ignore to avoid errors/crashes
        }}
        onScroll={() => {
          startShowActiveIndexVisibleTimer();
        }}
        data={sections}
        renderItem={({ item, index }: ListRenderItemInfo<SectionFullData>) => (
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
